/**
 * 차량 앱 「먼저 알림」 — PV5 화면에서 도는 쪽.
 *
 * 이 파일은 lib/pleos/*.ts 의 **인터페이스만** 쓴다 (Vehicle·CarPropertyManager·NaviHelper·Gleo).
 * 모의 구현을 실제 Pleos SDK로 바꿔 끼우면 같은 흐름이 그대로 돈다 → docs/PLEOS_PORTING.md
 *
 * 하는 일: 차량 신호(기어·차속·뒷문·SOC) + 내비 이벤트(TripInfo·DestinationInfo·도착) → 판단(lib/logic) →
 *          운전자에겐 음성 한마디(Gleo), 고객 발송은 서버가(차량에서 SMS 직접 발송 안 함).
 */
import { VehiclePropertyIds, aaosToGear, msToKmh, type CarPropertyEventCallback, type CarPropertyManager } from "../pleos/carProperty";
import type { GleoAction, GleoInterface, ProactiveSuggestion } from "../pleos/gleo";
import type { NaviHelper, NaviHelperEventListener, RouteInfo } from "../pleos/naviHelper";
import type { DoorPositionValue, DoorValue, Vehicle } from "../pleos/vehicle";
import type { MockHub } from "../pleos/mock/hub";
import type { DismissReason } from "../pleos/mock/mockGleo";
import { deriveDriveMode } from "../logic/driveMode";
import { delayForMessage, predictDelayMin, shouldAskDelay } from "../logic/delay";
import { canEnterUnderground, heightLabel, shouldPreArrivalCheck } from "../logic/preArrival";
import { predictOverrun } from "../logic/overrun";
import { REPLY_LABEL, type CustomerReply } from "../logic/replan";
import type { Rules } from "../logic/rules";
import { fmtHHMM, speakHHMM } from "../logic/time";
import { getNode, nodeLatLng, travelMin } from "../logic/travel";
import { epochMsToMin } from "./clock";
import type { CarAppState, GleoPending, Job } from "./types";
import day from "../../data/day.json";

/** [가정] proactive 제안·취소·거절 통로를 더한 Gleo 포트 */
export interface GleoPort extends GleoInterface {
  requestProactiveSuggestion(s: ProactiveSuggestion & { jobId: string; reason: GleoPending["reason"] }): void;
  setSuggestionDismissedHandler(h: (p: GleoPending, reason: DismissReason) => void): void;
  cancelSuggestion(): void;
}

export interface AppHub extends MockHub {
  nowMin(): number;
  overlay(text: string): void;
}

/** 서버(우리 백엔드)로 가는 호출 — 시제품은 같은 탭 안 모의 서버, 실서비스는 HTTPS API + 서버 푸시 */
export interface ServerPort {
  plan(): { jobs: Job[]; order: string[] };
  reportRouteStarted(jobId: string): void;
  reportRouteReplaced(jobId: string): void;
  reportEta(jobId: string, etaMin: number): void;
  sendDelayNotice(jobId: string, delayMin: number, etaMin: number, reason: "TRAFFIC" | "OVERRUN", approvedBy: "VOICE" | "TOUCH"): void;
  reportDeclined(jobId: string, delayMin: number, reason: DismissReason): void;
  requestPreArrivalCheck(jobId: string, remainMin: number, etaMin: number): void;
  reportArrival(jobId: string, atMin: number, placeLabel: string | null, odometerKm: number | null): void;
  reportWorkStarted(jobId: string, atMin: number): void;
  reportDeparture(jobId: string, atMin: number): void;
  sendDepartedToYou(jobId: string, etaMin: number): void;
  reportParkingRoute(jobId: string, entranceId: string): void;
}

export type ServerPush =
  | { kind: "REPLY"; jobId: string; reply: CustomerReply }
  | { kind: "REPLAN"; changedJobId: string; reply: CustomerReply; newNext: string | null; offerJobId: string | null }
  | { kind: "PARKING"; jobId: string; entranceId: string; label: string; underground: boolean; clearanceMm: number | null };

const OVERRUN_CHECK_SEC = 30;

export class CarApp {
  constructor(
    private d: {
      vehicle: Vehicle;
      props: CarPropertyManager;
      navi: NaviHelper;
      gleo: GleoPort;
      server: ServerPort;
      hub: AppHub;
      rules: Rules;
    },
  ) {}

  private get s(): CarAppState {
    return this.d.hub.app();
  }
  private now(): number {
    return this.d.hub.nowMin();
  }
  private job(id: string | null | undefined): Job | undefined {
    if (!id) return undefined;
    return this.d.server.plan().jobs.find((j) => j.id === id);
  }

  // ------------------------------------------------------------------ 시작: 리스너 등록 (SDK 사용 순서 그대로)
  start(fresh: boolean): void {
    const { vehicle, props, navi, gleo } = this.d;
    vehicle.initialize();
    const door = vehicle.getDoor();
    door.registerDoorPosition("REAR", this.onDoor);
    door.registerDoorPosition("ROW_1_LEFT", this.onDoor);
    vehicle.getEvBattery().registerEvBatteryStateOfCharge(this.onSoc);
    props.registerCallback(this.propCb, VehiclePropertyIds.GEAR_SELECTION, 0);
    props.registerCallback(this.propCb, VehiclePropertyIds.PERF_VEHICLE_SPEED, 1);
    navi.initialize();
    navi.addListener(this.naviListener);
    gleo.setActionHandler(this.onGleoAction);
    gleo.setSuggestionDismissedHandler(this.onDismissed);
    if (fresh) {
      const g = props.getProperty(VehiclePropertyIds.GEAR_SELECTION, 0);
      const sp = props.getProperty(VehiclePropertyIds.PERF_VEHICLE_SPEED, 0);
      this.s.gear = aaosToGear(g.value);
      this.s.speedKmh = Math.round(msToKmh(sp.value));
      door.getCurrentDoorPosition("REAR", (v) => (this.s.rearOpen = v === 1), () => {});
      vehicle.getEvBattery().getEvBatteryStateOfCharge((v) => (this.s.soc = v), () => {});
      this.s.mode = deriveDriveMode(this.s.gear, this.s.speedKmh);
      this.s.started = true;
    }
  }

  // ------------------------------------------------------------------ AAOS: 기어·차속
  private propCb: CarPropertyEventCallback = {
    onChangeEvent: (v) => {
      if (v.propertyId === VehiclePropertyIds.GEAR_SELECTION) this.s.gear = aaosToGear(v.value);
      if (v.propertyId === VehiclePropertyIds.PERF_VEHICLE_SPEED) this.s.speedKmh = Math.round(msToKmh(v.value));
      this.onMotionChanged();
    },
    onErrorEvent: () => {},
  };

  private onMotionChanged(): void {
    const s = this.s;
    const prevMode = s.mode;
    s.mode = deriveDriveMode(s.gear, s.speedKmh);
    if (prevMode !== s.mode) this.d.hub.log("APP", "주행 상태", `${prevMode} → ${s.mode}${s.mode === "PARKED" ? " · 터치 허용" : " · 터치 막음(음성·자동만)"}`);
    const moving = s.gear === "D" && s.speedKmh > 0;
    // 기능 3: 기어 D + 차속 > 0 으로 현장 이탈 → 작업 완료·출발
    const cur = this.job(s.currentJobId);
    if (moving && cur && (cur.status === "ARRIVED" || cur.status === "IN_PROGRESS")) {
      this.depart(cur);
      return;
    }
    if (moving && s.pendingDepartNotice) {
      const id = s.pendingDepartNotice;
      s.pendingDepartNotice = null;
      if (s.trip) this.d.server.sendDepartedToYou(id, s.trip.etaMin);
    }
    // 도착 이벤트 + 기어 P → 도착 확정
    if (s.arrivedPendingJobId && s.gear === "P") this.arrive();
  }

  // ------------------------------------------------------------------ Vehicle SDK: 뒷문·SOC
  private onDoor = (area: DoorValue, v: DoorPositionValue): void => {
    if (area !== "REAR") return;
    const s = this.s;
    s.rearOpen = v === 1;
    const cur = this.job(s.currentJobId);
    if (v === 1 && cur && cur.status === "ARRIVED") {
      this.d.server.reportWorkStarted(cur.id, this.now());
      s.banner = { kind: "WORK", text: `작업 시작 ${fmtHHMM(this.now())} 기록 · ${cur.customerAlias} 고객님께 알림`, atSec: this.now() * 60 };
    } else if (v === 1 && !cur) {
      this.d.hub.log("APP", "뒷문 열림", "현장 도착 전이라 작업 시작으로 기록하지 않음");
    }
  };

  private onSoc = (pct: number): void => {
    this.s.soc = pct;
  };

  // ------------------------------------------------------------------ NaviHelper 이벤트
  private naviListener: NaviHelperEventListener = {
    onRoutingCompleted: () => {
      if (this.s.route) this.s.route.routing = "COMPLETED";
    },
    onTripInfo: (t) => {
      const s = this.s;
      const etaMin = epochMsToMin(t.eta);
      s.trip = {
        etaMin,
        remainTimeSec: s.trip?.remainTimeSec ?? 0,
        remainDistM: s.trip?.remainDistM ?? 0,
        estimatedSocAtDest: t.estimatedSocAtDest,
      };
      const job = this.job(s.route?.jobId);
      if (!job || !["EN_ROUTE", "DELAY_NOTIFIED", "POSTPONED"].includes(job.status)) return;
      const last = s.lastEtaSent[job.id];
      if (last === undefined || Math.abs(last - etaMin) >= 2) {
        s.lastEtaSent[job.id] = etaMin;
        this.d.server.reportEta(job.id, etaMin);
      }
      // 기능 1: 지연 예측 → 물어보기
      const delay = predictDelayMin(etaMin, job.promisedMin);
      if (!s.gleo && shouldAskDelay(delay, s.notified[job.id], s.declined[job.id], this.d.rules)) {
        this.askDelay(job, delay, etaMin, "TRAFFIC");
      }
    },
    onDestinationInfo: (info) => {
      const s = this.s;
      if (s.trip) {
        s.trip.remainTimeSec = info.remainTime;
        s.trip.remainDistM = info.remainDistance;
      }
      // 기능 4: 남은 10분(또는 3km) → 「집에 계세요?」
      const job = this.job(s.route?.jobId);
      if (!job || !s.trip) return;
      if (shouldPreArrivalCheck({ remainTimeSec: info.remainTime, remainDistM: info.remainDistance, alreadySent: !!s.preArrivalSent[job.id] }, this.d.rules)) {
        s.preArrivalSent[job.id] = true;
        this.d.server.requestPreArrivalCheck(job.id, Math.max(1, Math.round(info.remainTime / 60)), s.trip.etaMin);
        s.banner = { kind: "PRE_ARRIVAL", text: `${job.customerAlias} 고객님께 「집에 계세요?」 보냄`, atSec: this.now() * 60 };
        s.chip = { text: "도착 전 확인 보냄", tone: "info", atSec: this.now() * 60 };
      }
    },
    onDestinationArrived: () => {
      const s = this.s;
      const job = this.job(s.route?.jobId);
      if (!job) return;
      s.arrivedPendingJobId = job.id;
      s.chip = { text: "목적지 도착 — 기어 P에서 도착 알림", tone: "info", atSec: this.now() * 60 };
      if (s.gear === "P") this.arrive();
    },
  };

  // ------------------------------------------------------------------ 흐름
  private askDelay(job: Job, delayMin: number, etaMin: number, reason: "TRAFFIC" | "OVERRUN"): void {
    const n = delayForMessage(delayMin);
    const again = this.s.notified[job.id] !== undefined;
    const prompt =
      reason === "OVERRUN"
        ? `작업이 길어지고 있어요. 다음 ${job.customerAlias} 고객님 도착이 ${speakHHMM(etaMin)}쯤, 약 ${n}분 늦어져요. 미리 알릴까요?`
        : again
          ? `${job.customerAlias} 고객님께 약 ${n}분 늦는다고 다시 알릴까요?`
          : `${job.customerAlias} 고객님께 약 ${n}분 늦는다고 알릴까요?`;
    this.s.lastAsk = { fn: "NOTIFY_DELAY", jobId: job.id, reason, delayMin, etaMin };
    this.d.hub.log("APP", "판단 predictDelayMin → shouldAskDelay", `${job.customerAlias} 약속 ${fmtHHMM(job.promisedMin)} · 예상 ${fmtHHMM(etaMin)} (+${delayMin}분 ≥ ${this.d.rules.delayThresholdMin}분)`);
    this.d.gleo.requestProactiveSuggestion({
      functionName: "NOTIFY_DELAY",
      promptKo: prompt,
      actionParameters: { delayMinutes: n },
      jobId: job.id,
      reason,
    });
  }

  private routeInfo(nodeId: string, poiName: string): RouteInfo {
    const ll = nodeLatLng(nodeId);
    return {
      latitude: ll.lat,
      longitude: ll.lng,
      displayLatitude: null,
      displayLongitude: null,
      poiName,
      poiId: nodeId,
      poiSubId: "0",
      address: getNode(nodeId).address,
    };
  }

  /** 내비엔 「다음 1곳」만 목적지로 — 경유지 최대 2개 제약 때문에 하루 일정은 앱·서버가 든다 */
  routeToJob(jobId: string, opts: { notifyWhenMoving?: boolean; nodeOverride?: string } = {}): void {
    const s = this.s;
    const job = this.job(jobId);
    if (!job) return;
    const node = opts.nodeOverride ?? job.parkingEntranceId ?? job.nodeId;
    const poiName = getNode(node).label;
    const prev = s.route?.jobId;
    if (prev && prev !== jobId) this.d.server.reportRouteReplaced(prev);
    s.route = { targetNodeId: node, poiName, jobId, routing: "STARTED" };
    s.currentJobId = jobId;
    s.arrivedPendingJobId = null;
    this.d.server.reportRouteStarted(jobId);
    this.d.navi.requestRoute(this.routeInfo(node, poiName));
    if (opts.notifyWhenMoving) {
      if (s.gear === "D" && s.speedKmh > 0 && s.trip) this.d.server.sendDepartedToYou(jobId, s.trip.etaMin);
      else s.pendingDepartNotice = jobId;
    }
  }

  private arrive(): void {
    const s = this.s;
    const job = this.job(s.arrivedPendingJobId);
    s.arrivedPendingJobId = null;
    if (!job) return;
    const node = s.route?.targetNodeId ?? job.nodeId;
    const placeLabel = node !== job.nodeId ? getNode(node).short : null;
    let km: number | null = null;
    this.d.vehicle.getOdometer().getCurrentDistanceDriven((v) => (km = v), () => {});
    this.d.server.reportArrival(job.id, this.now(), placeLabel, km);
    s.currentJobId = job.id;
    s.route = null;
    s.trip = null;
    s.banner = { kind: "ARRIVED", text: `도착 알림 보냄 · ${job.customerAlias} 고객님 (${fmtHHMM(this.now())})`, atSec: this.now() * 60 };
    s.chip = { text: "뒷문 열면 작업 시작 기록", tone: "info", atSec: this.now() * 60 };
  }

  private depart(cur: Job): void {
    const s = this.s;
    this.d.server.reportDeparture(cur.id, this.now());
    s.currentJobId = null;
    s.overrun = null;
    if (s.gleo && s.lastAsk?.reason === "OVERRUN") this.d.gleo.cancelSuggestion();
    const next = this.d.server.plan().order[0];
    if (next) {
      this.routeToJob(next, { notifyWhenMoving: true });
      const nj = this.job(next);
      s.banner = { kind: "DEPARTED", text: `작업 완료·출발 기록 → 다음 ${nj?.customerAlias ?? ""} 고객님께 「출발했어요」`, atSec: this.now() * 60 };
    } else {
      s.banner = { kind: "DEPARTED", text: "오늘 방문을 모두 마쳤어요", atSec: this.now() * 60 };
    }
  }

  // ------------------------------------------------------------------ Gleo Action (그래 → 함수 호출)
  private onGleoAction = (a: GleoAction): void => {
    const t0 = this.d.hub.realMs();
    const s = this.s;
    const plan = this.d.server.plan();
    const reply = (status: "success" | "fail", message: string, subtitleKo: string, data?: unknown) => {
      this.d.gleo.sendGleoBroadcast({
        functionName: a.action,
        status,
        message,
        mode: "voice",
        data: data ? JSON.stringify([data]) : undefined,
        subtitleKo,
      });
      this.d.hub.log("APP", "Callback 회신", `${this.d.hub.realMs() - t0}ms (7초 제한 안)`);
    };

    if (a.action === "NOTIFY_DELAY") {
      let jobId: string | undefined;
      let delay = 0;
      let eta = 0;
      let reason: "TRAFFIC" | "OVERRUN" = "TRAFFIC";
      if (s.lastAsk && s.lastAsk.fn === "NOTIFY_DELAY") {
        ({ jobId, delayMin: delay, etaMin: eta } = s.lastAsk);
        reason = s.lastAsk.reason === "OVERRUN" ? "OVERRUN" : "TRAFFIC";
      } else {
        const j = this.job(s.route?.jobId ?? plan.order[0]);
        if (j && s.trip) {
          jobId = j.id;
          eta = s.trip.etaMin;
          delay = predictDelayMin(eta, j.promisedMin);
        }
      }
      const job = this.job(jobId);
      if (!job || delay < 5) {
        reply("fail", "There is no delay to report for the next customer.", "다음 고객님께 알릴 만한 지연이 없어요.");
        return;
      }
      this.d.server.sendDelayNotice(job.id, delay, eta, reason, "VOICE");
      s.notified[job.id] = delay;
      s.lastAsk = null;
      if (reason === "OVERRUN") s.overrun = null;
      s.chip = { text: "지연 알림 보냄 ✓", tone: "ok", atSec: this.now() * 60 };
      const n = delayForMessage(delay);
      reply("success", `Sent a delay notice of about ${n} minutes to ${job.customerAlias}.`, `${job.customerAlias} 고객님께 약 ${n}분 늦는다고 보냈어요.`, { customer: job.customerAlias, delayMinutes: n });
      return;
    }

    if (a.action === "READ_NEXT_JOB") {
      const nextId = s.route?.jobId ?? plan.order[0];
      const next = this.job(nextId);
      if (!next) {
        reply("success", "There are no more visits today.", "오늘 남은 방문이 없어요.");
        return;
      }
      const after = this.job(plan.order.filter((id) => id !== next.id)[0]);
      const eta = s.route?.jobId === next.id && s.trip ? s.trip.etaMin : next.promisedMin;
      const ko =
        `다음은 ${next.customerAlias} 고객님, ${speakHHMM(eta)}쯤 도착해요.` +
        (after ? ` 그다음은 ${after.customerAlias} 고객님, ${speakHHMM(after.promisedMin)} 약속이에요.` : "");
      reply("success", `Next visit is ${next.customerAlias} around ${fmtHHMM(eta)}.`, ko, { next: next.customerAlias, eta: fmtHHMM(eta) });
      return;
    }

    if (a.action === "CHANGE_TO_PARKING") {
      const offer = s.parkingOffer;
      if (!offer) {
        reply("fail", "No parking entrance has been shared by the customer.", "고객님이 알려 준 주차장 입구가 아직 없어요.");
        return;
      }
      this.routeToJob(offer.jobId, { nodeOverride: offer.entranceId });
      this.d.server.reportParkingRoute(offer.jobId, offer.entranceId);
      s.parkingOffer = null;
      s.lastAsk = null;
      s.banner = { kind: "PARKING", text: `계심 ✓ · ${offer.label}로 안내`, atSec: this.now() * 60 };
      reply("success", `Changed the destination to ${offer.label}.`, `목적지를 ${offer.label}로 바꿨어요.`, { entrance: offer.label });
    }
  };

  private onDismissed = (p: GleoPending, reason: DismissReason): void => {
    const s = this.s;
    if (p.functionName === "NOTIFY_DELAY") {
      const delay = s.lastAsk?.delayMin ?? 0;
      s.declined[p.jobId] = delay;
      this.d.server.reportDeclined(p.jobId, delay, reason);
      if (s.lastAsk?.reason === "OVERRUN") s.overrun = null;
      s.chip = { text: reason === "TIMEOUT" ? "답이 없어 보내지 않음" : "안 보냄 (운전자 「아니」)", tone: "warn", atSec: this.now() * 60 };
    } else if (p.functionName === "CHANGE_TO_PARKING") {
      s.parkingOffer = null;
      s.chip = { text: "목적지 그대로 유지", tone: "info", atSec: this.now() * 60 };
    }
    s.lastAsk = null;
  };

  // ------------------------------------------------------------------ 서버 푸시 (고객 응답·재배치·주차 정보)
  onServerPush(msg: ServerPush): void {
    const s = this.s;
    if (msg.kind === "REPLY") {
      const job = this.job(msg.jobId);
      if (!job) return;
      const label = REPLY_LABEL[msg.reply];
      s.replyLine = `${job.customerAlias} 고객님: 「${label}」`;
      s.chip = { text: `${job.customerAlias}: ${label}`, tone: msg.reply === "HOME_NO" || msg.reply === "OTHER_DAY" ? "warn" : "ok", atSec: this.now() * 60 };
      const spoken: Partial<Record<CustomerReply, string>> = {
        WAIT: `${job.customerAlias} 고객님이 기다리신대요.`,
        HOME_YES: `${job.customerAlias} 고객님 집에 계신대요.`,
        OK_EARLIER: `${job.customerAlias} 고객님이 일찍 와도 좋대요.`,
        KEEP_ORIGINAL: `${job.customerAlias} 고객님은 원래 시간을 원하세요.`,
      };
      if (spoken[msg.reply]) this.d.hub.speak(spoken[msg.reply]!, "APP");
      if (msg.reply === "HOME_YES") s.banner = { kind: "PRE_ARRIVAL", text: `계심 ✓ · ${job.customerAlias} 고객님`, atSec: this.now() * 60 };
      return;
    }
    if (msg.kind === "REPLAN") {
      const changed = this.job(msg.changedJobId);
      delete s.notified[msg.changedJobId];
      delete s.declined[msg.changedJobId];
      delete s.lastEtaSent[msg.changedJobId];
      const cur = this.job(s.currentJobId);
      const onSite = cur && (cur.status === "ARRIVED" || cur.status === "IN_PROGRESS");
      const next = this.job(msg.newNext);
      const what = msg.reply === "POSTPONE_60" ? "1시간 뒤로 미루셨어요" : msg.reply === "POSTPONE_30" || msg.reply === "HOME_LATER_30" ? "30분 뒤로 미루셨어요" : "오늘 방문을 다른 날로 바꾸셨어요";
      if (!onSite && next && s.route?.jobId !== next.id) {
        if (s.gleo && s.lastAsk?.jobId === msg.changedJobId) this.d.gleo.cancelSuggestion();
        this.routeToJob(next.id);
        const text = `${changed?.customerAlias} 고객님이 ${what}. ${next.customerAlias} 고객님 먼저 갑니다.`;
        this.d.hub.speak(text, "APP");
        s.banner = { kind: "REORDER", text: `순서 변경 · ${next.customerAlias} 고객님 먼저 (목적지 교체)`, atSec: this.now() * 60 };
      } else {
        this.d.hub.speak(`${changed?.customerAlias} 고객님이 ${what}. 오늘 순서를 다시 짰어요.`, "APP");
        s.banner = { kind: "REORDER", text: "오늘 순서 다시 짬", atSec: this.now() * 60 };
      }
      return;
    }
    if (msg.kind === "PARKING") {
      const job = this.job(msg.jobId);
      if (!job) return;
      const height = day.driver.heightMm;
      if (msg.underground && !canEnterUnderground(height, msg.clearanceMm)) {
        s.chip = { text: `${msg.label}: 높이 제한으로 진입 어려움`, tone: "warn", atSec: this.now() * 60 };
        this.d.hub.speak(`${msg.label}은 높이 제한 때문에 들어가기 어려워요. 목적지는 그대로 둘게요.`, "APP");
        return;
      }
      s.parkingOffer = { jobId: job.id, entranceId: msg.entranceId, label: msg.label };
      s.lastAsk = { fn: "CHANGE_TO_PARKING", jobId: job.id, reason: "PARKING", delayMin: 0, etaMin: s.trip?.etaMin ?? 0 };
      const heightNote = msg.underground ? ` 이 차는 높이 ${heightLabel(height)}라 들어갈 수 있어요.` : "";
      this.d.gleo.requestProactiveSuggestion({
        functionName: "CHANGE_TO_PARKING",
        promptKo: `${job.customerAlias} 고객님이 ${msg.label}를 알려 주셨어요.${heightNote} 목적지를 바꿀까요?`,
        actionParameters: { entranceName: msg.label },
        jobId: job.id,
        reason: "PARKING",
      });
    }
  }

  // ------------------------------------------------------------------ 주기 판단 (C7 작업 시간 초과)
  tick(dtSec: number): void {
    const s = this.s;
    s.overrunAccumSec += dtSec;
    if (s.overrunAccumSec < OVERRUN_CHECK_SEC) return;
    s.overrunAccumSec = 0;
    const cur = this.job(s.currentJobId);
    if (!cur || cur.status !== "IN_PROGRESS" || cur.workStartedAt === null) return;
    const plan = this.d.server.plan();
    const next = this.job(plan.order[0]);
    if (!next) return;
    const now = this.now();
    const r = predictOverrun({
      workStartedMin: cur.workStartedAt,
      estWorkMin: cur.estWorkMin,
      nowMin: now,
      travelToNextMin: travelMin(cur.nodeId, next.nodeId, now),
      nextPromisedMin: next.promisedMin,
      minRemainWorkMin: this.d.rules.minRemainWorkMin,
    });
    // 이미 물어본 값은 답할 때까지 고정한다 — Gleo 음성(「12시 9분쯤」)과 화면 카드가 같은 시각을 말해야 한다.
    // 운전자가 답하지 않으면(시간 초과) onDismissed가 overrun을 지우고, 10분 더 밀리면 새 값으로 다시 묻는다.
    if (s.overrun && s.overrun.nextJobId === next.id) return;
    if (!s.gleo && shouldAskDelay(r.nextDelayMin, s.notified[next.id], s.declined[next.id], this.d.rules)) {
      s.overrun = { nextJobId: next.id, delayMin: r.nextDelayMin, etaMin: r.nextEtaMin };
      this.d.hub.log("APP", "판단 predictOverrun", `작업 예정 ${cur.estWorkMin}분 초과 예상 → 다음 ${next.customerAlias} +${r.nextDelayMin}분`);
      this.askDelay(next, r.nextDelayMin, r.nextEtaMin, "OVERRUN");
    }
  }

  // ------------------------------------------------------------------ 화면 입력
  /** 화면을 눌렀을 때 — 주행·정지 중엔 막는다 (도로교통법 제49조 ①11의2호) */
  touch(): boolean {
    if (this.s.mode !== "PARKED") {
      this.d.hub.overlay("주행 중에는 음성으로 · 정차(P) 후 사용");
      this.d.hub.log("APP", "터치 입력 막음", `CarUxRestrictions 흉내 · ${this.s.mode}`);
      return false;
    }
    return true;
  }

  tap(button: "START_FIRST" | "NOTIFY_OVERRUN" | "DISMISS_OVERRUN"): void {
    if (!this.touch()) return;
    const s = this.s;
    if (button === "START_FIRST") {
      const first = this.d.server.plan().order[0];
      if (first && !s.route) this.routeToJob(first, { notifyWhenMoving: true });
      return;
    }
    if (button === "NOTIFY_OVERRUN" && s.overrun) {
      const o = s.overrun;
      if (s.gleo) this.d.gleo.cancelSuggestion();
      this.d.server.sendDelayNotice(o.nextJobId, o.delayMin, o.etaMin, "OVERRUN", "TOUCH");
      s.notified[o.nextJobId] = o.delayMin;
      s.overrun = null;
      s.lastAsk = null;
      s.chip = { text: "다음 고객께 미리 알림 ✓", tone: "ok", atSec: this.now() * 60 };
      return;
    }
    if (button === "DISMISS_OVERRUN" && s.overrun) {
      s.declined[s.overrun.nextJobId] = s.overrun.delayMin;
      if (s.gleo) this.d.gleo.cancelSuggestion();
      s.overrun = null;
      s.lastAsk = null;
    }
  }
}
