/** 시연 엔진 상태 — 모두 직렬화 가능한 JSON (탭 간 BroadcastChannel로 그대로 보낸다). */
import type { GearLetter } from "../pleos/carProperty";
import type { DoorValue, DoorPositionValue } from "../pleos/vehicle";
import type { JobStatus } from "../logic/jobState";
import type { CustomerReply } from "../logic/replan";
import type { DriveMode } from "../logic/driveMode";
import type { GleoStatus } from "../pleos/gleo";

export type Layer = "AAOS" | "VEHICLE" | "NAVI" | "GLEO" | "APP" | "SERVER" | "CUSTOMER" | "SIM";

export interface ApiEvent {
  id: number;
  tSec: number;
  layer: Layer;
  name: string;
  detail?: string;
}

export interface Job {
  id: string;
  seq: number;
  customerAlias: string;
  phoneMasked: string;
  nodeId: string;
  place: string;
  work: string;
  promisedMin: number;
  originalPromisedMin: number;
  windowMin: number;
  estWorkMin: number;
  token: string;
  status: JobStatus;
  etaMin: number | null;
  /** 고객에게 실제로 보낸 도착 예정 시각 — 고객 링크는 이 값만 보여 준다(승인 전 ETA 변화는 노출하지 않음) */
  notifiedEtaMin: number | null;
  arrivedAt: number | null;
  workStartedAt: number | null;
  departedAt: number | null;
  parkingEntranceId: string | null;
}

export type NoticeTemplate =
  | "DELAY"
  | "PRE_ARRIVAL_CHECK"
  | "ARRIVED"
  | "WORK_STARTED"
  | "WORK_DONE"
  | "DEPARTED_TO_YOU"
  | "RESCHEDULE_OFFER"
  | "RESCHEDULE_DONE"
  | "PARKING_OK";

export interface Notice {
  id: number;
  jobId: string;
  template: NoticeTemplate;
  body: string;
  channel: "ALIMTALK_MOCK";
  approvedBy: "VOICE" | "TOUCH" | "AUTO";
  sentAtSec: number;
}

export type PendingKind = "DELAY" | "EARLIER_OFFER" | "PRE_ARRIVAL";

export interface CustomerSession {
  pending: null | { kind: PendingKind; noticeId: number; offerEtaMin?: number };
  lastReply: CustomerReply | null;
  home: "YES" | "LATER_30" | "NO" | null;
  parking: { registered: boolean; entranceId: string | null; sent: boolean };
}

export type OpsKind =
  | "DEPART"
  | "DELAY_NOTICE"
  | "REPLY"
  | "REPLAN"
  | "ARRIVE"
  | "WORK_START"
  | "DONE"
  | "PRE_ARRIVAL"
  | "PARKING"
  | "DECLINED"
  | "DAY_END";

export interface OpsEvent {
  id: number;
  tSec: number;
  jobId: string | null;
  kind: OpsKind;
  text: string;
}

export interface ServerStats {
  delayNotices: number;
  replies: number;
  replans: number;
  wastedTripsAvoided: number;
  maxDelayMin: number;
}

export interface ServerState {
  jobs: Job[];
  order: string[];
  notices: Notice[];
  timeline: OpsEvent[];
  sessions: Record<string, CustomerSession>;
  stats: ServerStats;
  dayEnded: boolean;
}

export type GleoFunction = "NOTIFY_DELAY" | "READ_NEXT_JOB" | "CHANGE_TO_PARKING";

export interface GleoPending {
  functionName: GleoFunction;
  promptKo: string;
  params: Record<string, string | number | boolean>;
  jobId: string;
  reason: "TRAFFIC" | "OVERRUN" | "PARKING";
  remainingMs: number;
  retried: boolean;
}

export interface GleoResult {
  functionName: string;
  status: GleoStatus;
  message: string;
  subtitleKo: string;
  untilRealMs: number;
}

export interface Chip {
  text: string;
  tone: "ok" | "warn" | "info" | "danger";
  atSec: number;
}

export interface Banner {
  kind: "REORDER" | "PRE_ARRIVAL" | "PARKING" | "ARRIVED" | "DEPARTED" | "WORK";
  text: string;
  atSec: number;
}

export interface CarAppState {
  started: boolean;
  gear: GearLetter;
  speedKmh: number;
  rearOpen: boolean;
  soc: number;
  mode: DriveMode;
  route: { targetNodeId: string; poiName: string; jobId: string | null; routing: "STARTED" | "COMPLETED" } | null;
  trip: { etaMin: number; remainTimeSec: number; remainDistM: number; estimatedSocAtDest: number } | null;
  arrivedPendingJobId: string | null;
  currentJobId: string | null;
  gleo: GleoPending | null;
  gleoResult: GleoResult | null;
  chip: Chip | null;
  replyLine: string | null;
  banner: Banner | null;
  overrun: { nextJobId: string; delayMin: number; etaMin: number } | null;
  notified: Record<string, number>;
  declined: Record<string, number>;
  preArrivalSent: Record<string, boolean>;
  lastEtaSent: Record<string, number>;
  overrunAccumSec: number;
  /** 앱이 마지막으로 운전자에게 물은 내용 (Gleo가 Action을 호출하면 이걸 보고 처리) */
  lastAsk: { fn: GleoFunction; jobId: string; reason: "TRAFFIC" | "OVERRUN" | "PARKING"; delayMin: number; etaMin: number } | null;
  parkingOffer: { jobId: string; entranceId: string; label: string } | null;
  pendingDepartNotice: string | null;
}

export interface Leg {
  from: string;
  to: string;
  poiName: string;
  totalBaseSec: number;
  totalDistM: number;
  progressBaseSec: number;
  factor: number;
  arrived: boolean;
}

export interface World {
  gear: GearLetter;
  speedKmh: number;
  doors: Record<DoorValue, DoorPositionValue>;
  locked: boolean;
  soc: number;
  seatDriver: "OCCUPIED" | "EMPTY";
  odometerKm: number;
  at: string;
  leg: Leg | null;
  tripEmitAccum: number;
  lastLoggedEta: number | null;
}

export interface Speech {
  id: number;
  text: string;
  source: "GLEO" | "APP";
  atSec: number;
  realMs: number;
}

export interface ScenarioRuntime {
  id: string;
  /** 마지막으로 적용한 단계 번호 (0 = 소개 단계) */
  stepIndex: number;
  finished: boolean;
  startSec: number;
}

export type Speed = 1 | 10 | 60;

export interface EngineState {
  v: 1;
  clockSec: number;
  realMs: number;
  playing: boolean;
  speed: Speed;
  holdMs: number;
  scenario: ScenarioRuntime;
  world: World;
  app: CarAppState;
  server: ServerState;
  log: ApiEvent[];
  speech: Speech[];
  overlay: { untilRealMs: number; text: string } | null;
  focusJobId: string | null;
  /** 마지막 단계의 멈춤 시간이 끝나면 자동 일시정지 */
  autoPause: boolean;
  seq: number;
  version: number;
}

export type VoiceCommand = "READ_NEXT_JOB" | "CHANGE_TO_PARKING" | "NOTIFY_DELAY";

export type SimAction =
  | { type: "sim.gear"; gear: GearLetter }
  | { type: "sim.speed"; kmh: number }
  | { type: "sim.door"; area: DoorValue; open: boolean }
  | { type: "sim.lock"; locked: boolean }
  | { type: "sim.soc"; pct: number }
  | { type: "sim.seat"; occupied: boolean }
  | { type: "navi.congestion"; addMin: number }
  | { type: "navi.clearCongestion" }
  | { type: "navi.remainKm"; km: number }
  | { type: "navi.arrive" }
  | { type: "voice.yes" }
  | { type: "voice.no" }
  | { type: "voice.command"; intent: VoiceCommand }
  | { type: "car.touch" }
  | { type: "car.tap"; button: "START_FIRST" | "NOTIFY_OVERRUN" | "DISMISS_OVERRUN" }
  | { type: "customer.reply"; jobId: string; reply: CustomerReply }
  | { type: "customer.parking"; jobId: string; registered: boolean; entranceId: string | null }
  | { type: "clock.advanceTo"; hhmm: string }
  | { type: "day.finish" }
  | { type: "admin.clock"; hhmm: string }
  | { type: "admin.at"; node: string }
  | { type: "admin.jobDone"; jobId: string; arrived: string; started: string; departed: string }
  | { type: "admin.onSite"; jobId: string; arrived: string; started: string }
  | { type: "admin.promised"; jobId: string; hhmm: string }
  | { type: "admin.clearTransient" };

export type ControlAction =
  | { type: "ctl.play" }
  | { type: "ctl.pause" }
  | { type: "ctl.speed"; speed: Speed }
  | { type: "ctl.load"; scenarioId: string }
  | { type: "ctl.next" }
  | { type: "ctl.prev" }
  | { type: "ctl.reset" }
  | { type: "ctl.jump"; index: number }
  | { type: "ctl.focus"; jobId: string | null };

export type EngineAction = SimAction | ControlAction;

export interface StepCaption {
  title: string;
  signal: string;
  decision: string;
  driver: string;
  companion: string;
}

export interface ScenarioStep {
  t: number;
  hold?: number;
  actions: SimAction[];
  caption: StepCaption;
}

export interface Scenario {
  id: string;
  title: string;
  short: string;
  summary: string;
  setup: SimAction[];
  steps: ScenarioStep[];
}
