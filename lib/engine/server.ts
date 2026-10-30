/**
 * 모의 서버 (우리 백엔드 역할) — 차량 앱 요청을 받아 고객에게 알림톡(모의)을 보내고, 고객 응답으로 순서를 다시 짠다.
 * 시제품에서는 같은 탭 메모리 안에서 돈다. 실서비스 = Next.js API(POST /api/notify, POST /api/reply/[token]) + 서버 푸시.
 * 차량 위치는 받지 않는다 — ETA(분)만 받는다.
 */
import { delayForMessage } from "../logic/delay";
import { nextJobStatus } from "../logic/jobState";
import { canEnterUnderground, heightLabel } from "../logic/preArrival";
import { REPLY_LABEL, applyReply, replan, type CustomerReply } from "../logic/replan";
import type { Rules } from "../logic/rules";
import { fmtHHMM, fmtWindow } from "../logic/time";
import { getNode, travelMin } from "../logic/travel";
import type { ServerPort, ServerPush } from "./carApp";
import type { Layer, CustomerSession, Job, Notice, NoticeTemplate, OpsKind, ServerState } from "./types";
import type { DismissReason } from "../pleos/mock/mockGleo";
import day from "../../data/day.json";

export interface ServerHub {
  state(): ServerState;
  nowMin(): number;
  nowSec(): number;
  nextId(): number;
  log(layer: Layer, name: string, detail?: string): void;
  push(msg: ServerPush): void;
  focus(jobId: string): void;
  /** 지금 차량 위치(또는 현재 현장)에서 jobId까지 분 */
  travelFromHere(jobId: string): number;
  /** 계획 시작 시각 (현장 작업 중이면 끝나는 예상 시각) */
  planStartMin(): number;
  rules: Rules;
}

const ALLOWED: Record<string, CustomerReply[]> = {
  DELAY: ["WAIT", "POSTPONE_30", "POSTPONE_60", "OTHER_DAY"],
  EARLIER_OFFER: ["OK_EARLIER", "KEEP_ORIGINAL"],
  PRE_ARRIVAL: ["HOME_YES", "HOME_LATER_30", "HOME_NO"],
};

export function blankSession(): CustomerSession {
  return { pending: null, lastReply: null, home: null, parking: { registered: false, entranceId: null, sent: false } };
}

export class MockServer implements ServerPort {
  constructor(private h: ServerHub) {}

  private get s(): ServerState {
    return this.h.state();
  }
  private job(id: string): Job {
    const j = this.s.jobs.find((x) => x.id === id);
    if (!j) throw new Error(`job 없음: ${id}`);
    return j;
  }
  private session(id: string): CustomerSession {
    if (!this.s.sessions[id]) this.s.sessions[id] = blankSession();
    return this.s.sessions[id];
  }
  private timeline(jobId: string | null, kind: OpsKind, text: string) {
    this.s.timeline.push({ id: this.h.nextId(), tSec: this.h.nowSec(), jobId, kind, text });
    if (this.s.timeline.length > 80) this.s.timeline.splice(0, this.s.timeline.length - 80);
  }
  private notify(jobId: string, template: NoticeTemplate, body: string, approvedBy: Notice["approvedBy"]): Notice {
    const job = this.job(jobId);
    const n: Notice = { id: this.h.nextId(), jobId, template, body, channel: "ALIMTALK_MOCK", approvedBy, sentAtSec: this.h.nowSec() };
    this.s.notices.push(n);
    if (this.s.notices.length > 60) this.s.notices.splice(0, this.s.notices.length - 60);
    this.h.log("SERVER", `POST /api/notify ${template} → ${job.customerAlias} (알림톡 모의)`, body);
    this.h.focus(jobId);
    return n;
  }

  plan() {
    return { jobs: this.s.jobs, order: this.s.order };
  }

  reportRouteStarted(jobId: string): void {
    const j = this.job(jobId);
    j.status = nextJobStatus(j.status, "ROUTE_STARTED");
  }
  reportRouteReplaced(jobId: string): void {
    const j = this.job(jobId);
    j.status = nextJobStatus(j.status, "ROUTE_REPLACED");
  }
  reportEta(jobId: string, etaMin: number): void {
    this.job(jobId).etaMin = etaMin;
    this.h.log("SERVER", `PUT /api/jobs/${jobId}/eta`, `${fmtHHMM(etaMin)} (위치 아님, 도착 예정 시각만)`);
  }

  sendDelayNotice(jobId: string, delayMin: number, etaMin: number, reason: "TRAFFIC" | "OVERRUN", approvedBy: "VOICE" | "TOUCH"): void {
    const j = this.job(jobId);
    const n = delayForMessage(delayMin);
    const why = reason === "OVERRUN" ? "앞 현장 작업이 길어져" : "길이 막혀";
    const who = reason === "OVERRUN" ? "기사님이 작업 중이라" : "기사님이 운전 중이라";
    const body = `${j.customerAlias} 고객님, ${why} 약 ${n}분 늦어요. ${fmtWindow(etaMin)} 사이 도착 예정이에요. ${who} 먼저 알려 드려요.`;
    const notice = this.notify(jobId, "DELAY", body, approvedBy);
    j.status = nextJobStatus(j.status, "DELAY_NOTIFIED");
    j.etaMin = etaMin;
    this.session(jobId).pending = { kind: "DELAY", noticeId: notice.id };
    this.s.stats.delayNotices++;
    this.s.stats.maxDelayMin = Math.max(this.s.stats.maxDelayMin, n);
    this.timeline(jobId, "DELAY_NOTICE", `${j.customerAlias} 고객님께 지연 알림 +${n}분 (${approvedBy === "VOICE" ? "음성 「그래」 승인" : "정차 중 터치 승인"})`);
  }

  reportDeclined(jobId: string, delayMin: number, reason: DismissReason): void {
    const j = this.job(jobId);
    this.timeline(jobId, "DECLINED", `${j.customerAlias} 지연 +${Math.round(delayMin)}분 알림 안 보냄 (${reason === "TIMEOUT" ? "무응답" : "운전자 거절"})`);
  }

  requestPreArrivalCheck(jobId: string, remainMin: number, etaMin: number): void {
    const j = this.job(jobId);
    const body = `약 ${remainMin}분 뒤(${fmtWindow(etaMin)}) 도착해요. 지금 집에 계세요? 이 차는 높이 ${heightLabel(day.driver.heightMm)}(PV5)예요.`;
    const notice = this.notify(jobId, "PRE_ARRIVAL_CHECK", body, "AUTO");
    j.etaMin = etaMin;
    this.session(jobId).pending = { kind: "PRE_ARRIVAL", noticeId: notice.id };
    this.timeline(jobId, "PRE_ARRIVAL", `${j.customerAlias} 고객님께 도착 ${remainMin}분 전 확인`);
  }

  reportArrival(jobId: string, atMin: number, placeLabel: string | null, odometerKm: number | null): void {
    const j = this.job(jobId);
    j.status = nextJobStatus(j.status, "ARRIVED_AND_PARKED");
    j.arrivedAt = atMin;
    j.etaMin = null;
    this.s.order = this.s.order.filter((id) => id !== jobId);
    this.notify(jobId, "ARRIVED", `기사님이 ${placeLabel ? placeLabel + "에 " : ""}도착했어요 (${fmtHHMM(atMin)}).`, "AUTO");
    this.session(jobId).pending = null;
    this.timeline(jobId, "ARRIVE", `${j.customerAlias} 도착 ${fmtHHMM(atMin)}${placeLabel ? " · " + placeLabel : ""}${odometerKm !== null ? ` · 누적 ${odometerKm.toFixed(1)}km` : ""}`);
  }

  reportWorkStarted(jobId: string, atMin: number): void {
    const j = this.job(jobId);
    j.status = nextJobStatus(j.status, "REAR_DOOR_OPENED");
    j.workStartedAt = atMin;
    this.notify(jobId, "WORK_STARTED", `장비를 내리고 작업을 시작했어요 (${fmtHHMM(atMin)}). 예상 작업 시간 약 ${j.estWorkMin}분.`, "AUTO");
    this.timeline(jobId, "WORK_START", `${j.customerAlias} 작업 시작 ${fmtHHMM(atMin)} (카고 뒷문 열림 [가정 매핑])`);
  }

  reportDeparture(jobId: string, atMin: number): void {
    const j = this.job(jobId);
    j.status = nextJobStatus(j.status, "DEPARTED");
    j.departedAt = atMin;
    this.s.order = this.s.order.filter((id) => id !== jobId);
    this.notify(jobId, "WORK_DONE", `작업을 마쳤어요 (${fmtHHMM(atMin)}). 이용해 주셔서 감사해요.`, "AUTO");
    this.timeline(jobId, "DONE", `${j.customerAlias} 작업 완료·출발 ${fmtHHMM(atMin)} (기어 D·차속 > 0)`);
  }

  sendDepartedToYou(jobId: string, etaMin: number): void {
    const j = this.job(jobId);
    const mins = Math.max(1, Math.round(etaMin - this.h.nowMin()));
    j.etaMin = etaMin;
    this.notify(jobId, "DEPARTED_TO_YOU", `기사님이 출발했어요. 약 ${mins}분 뒤, ${fmtWindow(etaMin)} 사이 도착 예정이에요.`, "AUTO");
    this.timeline(jobId, "DEPART", `${j.customerAlias} 고객님께 「출발했어요」 (약 ${mins}분)`);
  }

  reportParkingRoute(jobId: string, entranceId: string): void {
    const j = this.job(jobId);
    j.parkingEntranceId = entranceId;
    const label = getNode(entranceId).short;
    this.notify(jobId, "PARKING_OK", `알려 주신 ${label}로 갈게요. 방문 차량 등록 고마워요.`, "VOICE");
    this.timeline(jobId, "PARKING", `${j.customerAlias} 목적지 → ${label} (requestRoute)`);
  }

  // ------------------------------------------------------------------ 고객 쪽 (1회용 링크)
  customerReply(jobId: string, reply: CustomerReply): void {
    const j = this.job(jobId);
    const sess = this.session(jobId);
    const pending = sess.pending;
    this.h.log("CUSTOMER", `${j.customerAlias} 누름: ${REPLY_LABEL[reply]}`);
    if (!pending || !ALLOWED[pending.kind].includes(reply)) {
      this.h.log("SERVER", "응답 무시", "지금 답할 질문이 없음");
      return;
    }
    this.h.log("SERVER", `POST /api/reply/${j.token}`, reply);
    sess.pending = null;
    sess.lastReply = reply;
    this.s.stats.replies++;
    this.timeline(jobId, "REPLY", `${j.customerAlias}: 「${REPLY_LABEL[reply]}」`);
    if (reply === "HOME_YES") sess.home = "YES";
    if (reply === "HOME_LATER_30") sess.home = "LATER_30";
    if (reply === "HOME_NO") {
      sess.home = "NO";
      this.s.stats.wastedTripsAvoided++;
    }
    const before = j.promisedMin;
    const updated = applyReply(j, reply, pending.offerEtaMin);
    Object.assign(j, updated);
    this.h.push({ kind: "REPLY", jobId, reply });

    if (reply === "OK_EARLIER") {
      this.notify(jobId, "RESCHEDULE_DONE", `고마워요. ${fmtWindow(j.promisedMin)} 사이에 갈게요.`, "AUTO");
    }
    if (["POSTPONE_30", "POSTPONE_60", "HOME_LATER_30"].includes(reply)) {
      this.notify(jobId, "RESCHEDULE_DONE", `요청대로 방문 시각을 ${fmtHHMM(before)} → ${fmtHHMM(j.promisedMin)}쯤으로 바꿨어요.`, "AUTO");
      this.replanAndPush(jobId, reply);
    }
    if (reply === "OTHER_DAY" || reply === "HOME_NO") {
      this.notify(jobId, "RESCHEDULE_DONE", "오늘 방문은 취소하고, 업체에서 다른 날짜를 연락드릴게요.", "AUTO");
      this.replanAndPush(jobId, reply);
    }
  }

  private replanAndPush(changedJobId: string, reply: CustomerReply): void {
    const now = this.h.nowMin();
    const nodeOf = (id: string) => this.job(id).nodeId;
    const r = replan({
      jobs: this.s.jobs,
      startMin: this.h.planStartMin(),
      travelFromHere: (id) => this.h.travelFromHere(id),
      travel: (a, b) => travelMin(nodeOf(a), nodeOf(b), now),
      earlierOfferMin: this.h.rules.earlierOfferMin,
    });
    const prev = this.s.order.join(" > ");
    this.s.order = r.order;
    this.s.stats.replans++;
    const aliases = r.order.map((id) => this.job(id).customerAlias).join(" → ");
    this.h.log("SERVER", "replan() — 오늘 순서 다시 짜기", `${prev} ⇒ ${r.order.join(" > ")}`);
    this.timeline(changedJobId, "REPLAN", `순서 변경: ${aliases}`);
    let offerJobId: string | null = null;
    if (r.offer && r.offer.jobId !== changedJobId) {
      const oj = this.job(r.offer.jobId);
      const notice = this.notify(
        oj.id,
        "RESCHEDULE_OFFER",
        `앞 일정이 바뀌어 더 일찍 갈 수 있어요. 원래 ${fmtHHMM(oj.promisedMin)} 약속인데 ${fmtWindow(r.offer.etaMin)} 사이 도착 가능해요. 괜찮으세요?`,
        "AUTO",
      );
      this.session(oj.id).pending = { kind: "EARLIER_OFFER", noticeId: notice.id, offerEtaMin: r.offer.etaMin };
      offerJobId = oj.id;
    }
    this.h.push({ kind: "REPLAN", changedJobId, reply, newNext: r.order[0] ?? null, offerJobId });
  }

  customerParking(jobId: string, registered: boolean, entranceId: string | null): void {
    const j = this.job(jobId);
    const sess = this.session(jobId);
    sess.parking = { registered, entranceId, sent: true };
    const ent = entranceId ? (day.parking as Record<string, { entrances: { id: string; label: string; underground: boolean; clearanceMm: number | null }[] }>)[jobId]?.entrances.find((e) => e.id === entranceId) : undefined;
    this.h.log("CUSTOMER", `${j.customerAlias} 주차 안내 보냄`, `방문 차량 등록 ${registered ? "완료" : "안 함"}${ent ? " · " + ent.label : ""}`);
    this.h.log("SERVER", `POST /api/parking/${j.token}`, ent ? ent.label : "입구 선택 없음");
    this.timeline(jobId, "PARKING", `${j.customerAlias}: 방문 차량 등록 ${registered ? "완료 ✓" : "안 함"}${ent ? " · " + ent.label : ""}`);
    if (ent) {
      const ok = !ent.underground || canEnterUnderground(day.driver.heightMm, ent.clearanceMm);
      if (!ok) this.h.log("SERVER", "높이 제한 확인", `${ent.label} 진입 어려움`);
      this.h.push({ kind: "PARKING", jobId, entranceId: ent.id, label: ent.label, underground: ent.underground, clearanceMm: ent.clearanceMm });
    }
  }
}
