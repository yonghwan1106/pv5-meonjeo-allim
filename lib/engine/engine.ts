/**
 * 시연 엔진 — 시뮬레이터(Virtual Console 흉내) → 모의 SDK → 차량 앱 → 모의 서버 → 고객 화면을 한 상태로 묶는다.
 * 상태(EngineState)는 전부 JSON이라 BroadcastChannel로 다른 탭에 그대로 보낼 수 있고, 어느 탭이든 이어받을 수 있다.
 */
import { VehiclePropertyIds } from "../pleos/carProperty";
import { MockCarPropertyManager } from "../pleos/mock/mockCarProperty";
import { MockGleo } from "../pleos/mock/mockGleo";
import { MockNaviHelper, SOC_PCT_PER_KM } from "../pleos/mock/mockNaviHelper";
import { MockVehicle } from "../pleos/mock/mockVehicle";
import type { DoorValue } from "../pleos/vehicle";
import { deriveDriveMode } from "../logic/driveMode";
import { DEFAULT_RULES } from "../logic/rules";
import { parseHHMM } from "../logic/time";
import { hourFactor, travelFromLegBase, travelMin } from "../logic/travel";
import { CarApp, type AppHub, type ServerPush } from "./carApp";
import { MockServer, blankSession } from "./server";
import { SCENARIOS, getScenario } from "./scenarios";
import type { CarAppState, EngineAction, EngineState, Job, Layer, ServerState, SimAction, Speed, World } from "./types";
import day from "../../data/day.json";

const LOG_CAP = 160;
const SPEECH_CAP = 12;
const SUBSTEP_SEC = 5;
export const DEFAULT_HOLD_MS = 3000;

export function initialJobs(): Job[] {
  return day.jobs.map((j) => ({
    id: j.id,
    seq: j.seq,
    customerAlias: j.customerAlias,
    phoneMasked: j.phoneMasked,
    nodeId: j.id,
    place: day.nodes.find((n) => n.id === j.id)!.label,
    work: j.work,
    promisedMin: parseHHMM(j.promised),
    originalPromisedMin: parseHHMM(j.promised),
    windowMin: j.windowMin,
    estWorkMin: j.estWorkMin,
    token: j.token,
    status: "SCHEDULED",
    etaMin: null,
    notifiedEtaMin: null,
    arrivedAt: null,
    workStartedAt: null,
    departedAt: null,
    parkingEntranceId: null,
  }));
}

function blankWorld(): World {
  return {
    gear: "P",
    speedKmh: 0,
    doors: { ROW_1_LEFT: 0, ROW_1_RIGHT: 0, ROW_2_RIGHT: 0, REAR: 0 },
    locked: false,
    soc: 82,
    seatDriver: "OCCUPIED",
    odometerKm: 12480.4,
    at: "DEPOT",
    leg: null,
    tripEmitAccum: 0,
    lastLoggedEta: null,
  };
}

function blankApp(): CarAppState {
  return {
    started: false,
    gear: "P",
    speedKmh: 0,
    rearOpen: false,
    soc: 82,
    mode: "PARKED",
    route: null,
    trip: null,
    arrivedPendingJobId: null,
    currentJobId: null,
    gleo: null,
    gleoResult: null,
    chip: null,
    replyLine: null,
    banner: null,
    overrun: null,
    notified: {},
    declined: {},
    preArrivalSent: {},
    lastEtaSent: {},
    overrunAccumSec: 0,
    lastAsk: null,
    parkingOffer: null,
    pendingDepartNotice: null,
  };
}

function blankServer(): ServerState {
  const jobs = initialJobs();
  return {
    jobs,
    order: jobs.map((j) => j.id),
    notices: [],
    timeline: [],
    sessions: Object.fromEntries(jobs.map((j) => [j.id, blankSession()])),
    stats: { delayNotices: 0, replies: 0, replans: 0, wastedTripsAvoided: 0, maxDelayMin: 0 },
    dayEnded: false,
  };
}

export function blankState(speed: Speed = 10, seq = 0): EngineState {
  return {
    v: 1,
    clockSec: parseHHMM("08:20") * 60,
    realMs: 0,
    playing: false,
    speed,
    holdMs: 0,
    scenario: { id: "S1", stepIndex: -1, finished: false, startSec: 0 },
    world: blankWorld(),
    app: blankApp(),
    server: blankServer(),
    log: [],
    speech: [],
    overlay: null,
    focusJobId: null,
    autoPause: false,
    seq,
    version: 0,
  };
}

export class DemoEngine {
  s!: EngineState;
  private muted = 0;
  vehicle!: MockVehicle;
  props!: MockCarPropertyManager;
  navi!: MockNaviHelper;
  gleo!: MockGleo;
  app!: CarApp;
  server!: MockServer;
  readonly rules = DEFAULT_RULES;

  constructor(snapshot?: EngineState) {
    if (snapshot) {
      this.s = JSON.parse(JSON.stringify(snapshot)) as EngineState;
      this.wire(false);
    } else {
      this.load("S1");
    }
  }

  // ------------------------------------------------------------------ 배선
  private makeHub(): AppHub {
    return {
      world: () => this.s.world,
      app: () => this.s.app,
      nowSec: () => this.s.clockSec,
      nowMin: () => this.s.clockSec / 60,
      realMs: () => this.s.realMs,
      log: (l, n, d) => this.log(l, n, d),
      speak: (t, src) => this.speak(t, src),
      overlay: (text) => {
        this.s.overlay = { untilRealMs: this.s.realMs + 4000, text };
      },
    };
  }

  private wire(fresh: boolean): void {
    const hub = this.makeHub();
    this.vehicle = new MockVehicle(hub);
    this.props = new MockCarPropertyManager(hub);
    this.navi = new MockNaviHelper(hub, { stopVehicle: () => this.stopVehicle() });
    this.gleo = new MockGleo(hub);
    this.server = new MockServer({
      state: () => this.s.server,
      nowMin: () => this.s.clockSec / 60,
      nowSec: () => this.s.clockSec,
      nextId: () => ++this.s.seq,
      log: (l, n, d) => this.log(l, n, d),
      push: (msg: ServerPush) => {
        this.log("SERVER", `push → 차량 앱 ${msg.kind}`, "실서비스: 서버 푸시");
        this.app.onServerPush(msg);
      },
      focus: (jobId) => {
        this.s.focusJobId = jobId;
      },
      travelFromHere: (jobId) => this.travelFromHere(jobId),
      planStartMin: () => this.planStartMin(),
      rules: this.rules,
    });
    this.app = new CarApp({ vehicle: this.vehicle, props: this.props, navi: this.navi, gleo: this.gleo, server: this.server, hub, rules: this.rules });
    if (!fresh) this.muted++;
    this.app.start(fresh);
    if (!fresh) this.muted--;
  }

  private stopVehicle(): void {
    if (this.s.world.speedKmh !== 0) {
      this.s.world.speedKmh = 0;
      this.log("SIM", "운전자가 정차 (차속 0)");
      this.props.simEmit(VehiclePropertyIds.PERF_VEHICLE_SPEED);
    }
  }

  private travelFromHere(jobId: string): number {
    const node = this.s.server.jobs.find((j) => j.id === jobId)?.nodeId ?? jobId;
    const now = this.s.clockSec / 60;
    const leg = this.s.world.leg;
    if (leg && !leg.arrived) {
      const p = leg.totalBaseSec > 0 ? leg.progressBaseSec / leg.totalBaseSec : 0;
      return travelFromLegBase(leg.from, leg.to, p, node) * hourFactor(now);
    }
    return travelMin(this.s.world.at, node, now);
  }

  private planStartMin(): number {
    const now = this.s.clockSec / 60;
    const cur = this.s.server.jobs.find((j) => j.id === this.s.app.currentJobId);
    if (cur && (cur.status === "ARRIVED" || cur.status === "IN_PROGRESS")) {
      const start = cur.workStartedAt ?? cur.arrivedAt ?? now;
      return Math.max(now + this.rules.minRemainWorkMin, start + cur.estWorkMin);
    }
    return now;
  }

  // ------------------------------------------------------------------ 기록
  log(layer: Layer, name: string, detail?: string): void {
    if (this.muted > 0) return;
    this.s.log.push({ id: ++this.s.seq, tSec: this.s.clockSec, layer, name, detail });
    if (this.s.log.length > LOG_CAP) this.s.log.splice(0, this.s.log.length - LOG_CAP);
  }

  speak(text: string, source: "GLEO" | "APP"): void {
    if (this.muted > 0) return;
    this.s.speech.push({ id: ++this.s.seq, text, source, atSec: this.s.clockSec, realMs: this.s.realMs });
    if (this.s.speech.length > SPEECH_CAP) this.s.speech.splice(0, this.s.speech.length - SPEECH_CAP);
  }

  // ------------------------------------------------------------------ 시나리오
  load(id: string): void {
    const sc = getScenario(id);
    const prevSpeed = this.s?.speed ?? 10;
    const prevSeq = this.s?.seq ?? 0;
    const prevReal = this.s?.realMs ?? 0;
    this.s = blankState(prevSpeed, prevSeq);
    this.s.realMs = prevReal;
    this.s.scenario = { id: sc.id, stepIndex: -1, finished: false, startSec: 0 };
    this.wire(true);
    this.log("SIM", `── 시나리오 준비: ${sc.title}`);
    for (const a of sc.setup) this.applySim(a);
    this.clearTransient();
    this.s.scenario.startSec = this.s.clockSec;
    this.log("SIM", `── 시나리오 시작 ${sc.short}`);
    this.applyStep(0);
    this.s.playing = false;
    this.s.holdMs = 0;
    this.s.autoPause = false;
  }

  private clearTransient(): void {
    this.s.app.gleoResult = null;
    this.s.overlay = null;
    this.s.speech = [];
  }

  private applyStep(i: number): void {
    const sc = getScenario(this.s.scenario.id);
    const st = sc.steps[i];
    if (!st) return;
    for (const a of st.actions) this.applySim(a);
    this.s.scenario.stepIndex = i;
    if (i >= sc.steps.length - 1) this.s.scenario.finished = true;
  }

  private advanceClock(dtSec: number): void {
    let left = dtSec;
    while (left > 1e-9) {
      const d = Math.min(SUBSTEP_SEC, left);
      left -= d;
      this.s.clockSec += d;
      this.physics(d);
      this.app.tick(d);
    }
  }

  private physics(d: number): void {
    const w = this.s.world;
    const driving = w.speedKmh > 0 && (w.gear === "D" || w.gear === "R");
    if (driving) {
      const km = (w.speedKmh * d) / 3600;
      w.odometerKm += km;
      const before = Math.floor(w.soc);
      w.soc = Math.max(0, w.soc - km * SOC_PCT_PER_KM);
      if (Math.floor(w.soc) !== before) this.vehicle.evBattery.simSocChanged();
    }
    this.navi.simTick(d);
  }

  private jumpTo(index: number): void {
    const sc = getScenario(this.s.scenario.id);
    const target = Math.max(0, Math.min(index, sc.steps.length - 1));
    const playing = false;
    this.load(sc.id);
    for (let i = 1; i <= target; i++) {
      const st = sc.steps[i];
      const tgt = this.s.scenario.startSec + st.t;
      if (tgt > this.s.clockSec) this.advanceClock(tgt - this.s.clockSec);
      this.applyStep(i);
    }
    this.s.playing = playing;
    this.s.holdMs = 0;
  }

  private nextStep(): void {
    const sc = getScenario(this.s.scenario.id);
    const i = this.s.scenario.stepIndex + 1;
    const st = sc.steps[i];
    if (!st) return;
    const tgt = this.s.scenario.startSec + st.t;
    if (tgt > this.s.clockSec) this.advanceClock(tgt - this.s.clockSec);
    this.applyStep(i);
    this.s.holdMs = this.s.playing ? (st.hold ?? DEFAULT_HOLD_MS) : 0;
    if (this.s.scenario.finished && this.s.playing) this.s.autoPause = true;
  }

  // ------------------------------------------------------------------ 입력
  dispatch(a: EngineAction): void {
    switch (a.type) {
      case "ctl.play":
        this.s.playing = true;
        break;
      case "ctl.pause":
        this.s.playing = false;
        break;
      case "ctl.speed":
        this.s.speed = a.speed;
        break;
      case "ctl.load":
        this.load(a.scenarioId);
        break;
      case "ctl.reset":
        this.load(this.s.scenario.id);
        break;
      case "ctl.next":
        this.nextStep();
        break;
      case "ctl.prev":
        this.jumpTo(this.s.scenario.stepIndex - 1);
        break;
      case "ctl.jump":
        this.jumpTo(a.index);
        break;
      case "ctl.focus":
        this.s.focusJobId = a.jobId;
        break;
      default:
        this.applySim(a);
    }
    this.s.version++;
  }

  applySim(a: SimAction): void {
    const w = this.s.world;
    switch (a.type) {
      case "sim.gear": {
        if (a.gear === "P" && w.speedKmh > 0) this.stopVehicle();
        w.gear = a.gear;
        this.log("SIM", `Gear Selection → ${a.gear}`);
        this.props.simEmit(VehiclePropertyIds.GEAR_SELECTION);
        break;
      }
      case "sim.speed": {
        const kmh = Math.max(0, Math.min(130, Math.round(a.kmh)));
        if (kmh > 0 && (w.gear === "P" || w.gear === "N")) {
          w.gear = "D";
          this.log("SIM", "Gear Selection → D", "속도를 주려면 D (자동 변경)");
          this.props.simEmit(VehiclePropertyIds.GEAR_SELECTION);
        }
        w.speedKmh = kmh;
        this.log("SIM", `Vehicle Speed → ${kmh} km/h`);
        this.props.simEmit(VehiclePropertyIds.PERF_VEHICLE_SPEED);
        break;
      }
      case "sim.door":
        w.doors[a.area as DoorValue] = a.open ? 1 : 0;
        this.log("SIM", `Door Position ${a.area} → ${a.open ? "Open" : "Closed"}`);
        this.vehicle.door.simDoorChanged(a.area);
        break;
      case "sim.lock":
        w.locked = a.locked;
        this.vehicle.door.simLockChanged();
        break;
      case "sim.soc":
        w.soc = Math.max(0, Math.min(100, a.pct));
        this.vehicle.evBattery.simSocChanged();
        break;
      case "sim.seat":
        w.seatDriver = a.occupied ? "OCCUPIED" : "EMPTY";
        this.vehicle.seat.simSeatChanged();
        break;
      case "navi.congestion":
        this.navi.simCongestion(a.addMin);
        break;
      case "navi.clearCongestion":
        this.navi.simClearCongestion();
        break;
      case "navi.remainKm":
        this.navi.simRemainKm(a.km);
        break;
      case "navi.arrive":
        this.navi.simArrive();
        break;
      case "voice.yes":
        this.gleo.simUserYes();
        break;
      case "voice.no":
        this.gleo.simUserNo();
        break;
      case "voice.command":
        this.gleo.simCommand(a.intent);
        break;
      case "car.touch":
        this.log("SIM", "차량 화면 터치 시도");
        this.app.touch();
        break;
      case "car.tap":
        this.app.tap(a.button);
        break;
      case "customer.reply":
        this.server.customerReply(a.jobId, a.reply);
        break;
      case "customer.parking":
        this.server.customerParking(a.jobId, a.registered, a.entranceId);
        break;
      case "clock.advanceTo": {
        const tgt = parseHHMM(a.hhmm) * 60;
        if (tgt > this.s.clockSec) {
          this.log("SIM", `시간 건너뛰기 → ${a.hhmm}`);
          this.advanceClock(tgt - this.s.clockSec);
        }
        break;
      }
      case "day.finish":
        this.finishDay();
        break;
      case "admin.clock":
        this.s.clockSec = parseHHMM(a.hhmm) * 60;
        break;
      case "admin.at":
        w.at = a.node;
        w.leg = null;
        break;
      case "admin.jobDone": {
        const j = this.s.server.jobs.find((x) => x.id === a.jobId)!;
        j.status = "DONE";
        j.arrivedAt = parseHHMM(a.arrived);
        j.workStartedAt = parseHHMM(a.started);
        j.departedAt = parseHHMM(a.departed);
        this.s.server.order = this.s.server.order.filter((id) => id !== a.jobId);
        this.s.server.timeline.push({ id: ++this.s.seq, tSec: j.departedAt * 60, jobId: j.id, kind: "DONE", text: `${j.customerAlias} 작업 완료 ${a.departed} (이전 기록)` });
        break;
      }
      case "admin.onSite": {
        const j = this.s.server.jobs.find((x) => x.id === a.jobId)!;
        j.status = "IN_PROGRESS";
        j.arrivedAt = parseHHMM(a.arrived);
        j.workStartedAt = parseHHMM(a.started);
        this.s.server.order = this.s.server.order.filter((id) => id !== a.jobId);
        this.s.app.currentJobId = j.id;
        w.at = j.nodeId;
        w.leg = null;
        this.s.server.timeline.push({ id: ++this.s.seq, tSec: j.workStartedAt * 60, jobId: j.id, kind: "WORK_START", text: `${j.customerAlias} 작업 중 (${a.started} 시작)` });
        break;
      }
      case "admin.promised": {
        const j = this.s.server.jobs.find((x) => x.id === a.jobId)!;
        j.promisedMin = parseHHMM(a.hhmm);
        this.s.server.order.sort(
          (x, y) => this.s.server.jobs.find((q) => q.id === x)!.promisedMin - this.s.server.jobs.find((q) => q.id === y)!.promisedMin,
        );
        break;
      }
      case "admin.clearTransient":
        this.clearTransient();
        break;
    }
  }

  private finishDay(): void {
    const sv = this.s.server;
    const w = this.s.world;
    let t = this.s.clockSec / 60;
    let at = w.at;
    const cur = sv.jobs.find((j) => j.id === this.s.app.currentJobId);
    if (cur && (cur.status === "ARRIVED" || cur.status === "IN_PROGRESS")) {
      cur.status = "DONE";
      cur.departedAt = Math.max(t, (cur.workStartedAt ?? t) + cur.estWorkMin);
      t = cur.departedAt;
      at = cur.nodeId;
    }
    for (const id of sv.order) {
      const j = sv.jobs.find((x) => x.id === id)!;
      const arrive = t + travelMin(at, j.nodeId, t);
      j.arrivedAt = arrive;
      j.workStartedAt = arrive + 2;
      j.departedAt = j.workStartedAt + j.estWorkMin;
      j.status = "DONE";
      j.etaMin = null;
      j.notifiedEtaMin = null;
      t = j.departedAt;
      at = j.nodeId;
      sv.timeline.push({ id: ++this.s.seq, tSec: t * 60, jobId: j.id, kind: "DONE", text: `${j.customerAlias} 작업 완료 (빨리 감기)` });
    }
    sv.order = [];
    t += travelMin(at, "DEPOT", t);
    this.s.clockSec = Math.max(this.s.clockSec, t * 60);
    w.at = "DEPOT";
    w.leg = null;
    w.speedKmh = 0;
    w.gear = "P";
    this.log("SIM", "하루 마무리 (빨리 감기)");
    this.props.simEmit(VehiclePropertyIds.PERF_VEHICLE_SPEED, true);
    this.props.simEmit(VehiclePropertyIds.GEAR_SELECTION);
    const app = this.s.app;
    app.route = null;
    app.trip = null;
    app.currentJobId = null;
    app.overrun = null;
    app.gleo = null;
    app.mode = deriveDriveMode("P", 0);
    sv.dayEnded = true;
    sv.timeline.push({ id: ++this.s.seq, tSec: this.s.clockSec, jobId: null, kind: "DAY_END", text: "하루 끝 — 요약 생성" });
  }

  /** 실시간 진행. 바뀐 게 있으면 true */
  tick(realDtMs: number): boolean {
    const s = this.s;
    s.realMs += realDtMs;
    let changed = false;
    if (s.overlay && s.realMs >= s.overlay.untilRealMs) {
      s.overlay = null;
      changed = true;
    }
    if (s.app.gleoResult && s.realMs >= s.app.gleoResult.untilRealMs) {
      s.app.gleoResult = null;
      changed = true;
    }
    if (s.playing) {
      changed = true;
      this.gleo.simTick(realDtMs);
      if (s.holdMs > 0) {
        s.holdMs -= realDtMs;
        if (s.holdMs <= 0) {
          s.holdMs = 0;
          if (s.autoPause) {
            s.autoPause = false;
            s.playing = false;
          }
        }
      } else {
        const simDt = (realDtMs / 1000) * s.speed;
        const sc = getScenario(s.scenario.id);
        const next = sc.steps[s.scenario.stepIndex + 1];
        if (next) {
          const tgt = s.scenario.startSec + next.t;
          if (s.clockSec + simDt >= tgt) {
            this.nextStep();
          } else this.advanceClock(simDt);
        } else {
          this.advanceClock(simDt); // 시나리오가 끝난 뒤 다시 재생 = 자유 진행
        }
      }
    }
    if (changed) s.version++;
    return changed;
  }
}

export { SCENARIOS };
