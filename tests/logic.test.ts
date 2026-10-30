import { describe, expect, it } from "vitest";
import { deriveDriveMode, isTouchAllowed, activeUxRestrictions, screenBudget } from "@/lib/logic/driveMode";
import { delayForMessage, predictDelayMin, shouldAskDelay } from "@/lib/logic/delay";
import { canEnterUnderground, heightLabel, shouldPreArrivalCheck } from "@/lib/logic/preArrival";
import { nextJobStatus } from "@/lib/logic/jobState";
import { applyReply, naviTargets, replan, type PlanJob } from "@/lib/logic/replan";
import { predictOverrun } from "@/lib/logic/overrun";
import { matchVoiceIntent, validateAppSchema } from "@/lib/logic/voice";
import { etaWindow, fmtHHMM, fmtWindow, parseHHMM } from "@/lib/logic/time";
import { hourFactor, travelBaseMin, travelFromLegBase, travelMin } from "@/lib/logic/travel";
import { DEFAULT_RULES } from "@/lib/logic/rules";
import { toCustomerView } from "@/lib/logic/customerView";
import { UxRestrictions } from "@/lib/pleos/carProperty";
import { MAX_ACTION_CALLS, type AppSchema } from "@/lib/pleos/gleo";
import { MAX_WAYPOINTS } from "@/lib/pleos/naviHelper";
import { APP_SCHEMA as schema } from "@/lib/pleos/appSchema";
import { initialJobs } from "@/lib/engine/engine";
import { blankSession } from "@/lib/engine/server";

const R = DEFAULT_RULES;

describe("주행 상태 3단 (deriveDriveMode)", () => {
  it("기어 P + 차속 0 = 주차, 터치 허용", () => {
    expect(deriveDriveMode("P", 0)).toBe("PARKED");
    expect(isTouchAllowed("P", 0)).toBe(true);
  });
  it("기어 D + 차속 0 = 정지(신호 대기), 터치는 막음", () => {
    expect(deriveDriveMode("D", 0)).toBe("STOPPED");
    expect(isTouchAllowed("D", 0)).toBe(false);
  });
  it("차속 1km/h만 있어도 주행 (경계값)", () => {
    expect(deriveDriveMode("D", 1)).toBe("DRIVING");
    expect(deriveDriveMode("P", 1)).toBe("DRIVING");
  });
  it("후진 R은 차속 0이어도 주행으로 본다", () => {
    expect(deriveDriveMode("R", 0)).toBe("DRIVING");
    expect(isTouchAllowed("R", 0)).toBe(false);
  });
  it("주행 중 UX 제한에 NO_KEYBOARD·NO_VIDEO가 켜지고, 주차면 0", () => {
    const r = activeUxRestrictions("DRIVING");
    expect(r & UxRestrictions.UX_RESTRICTIONS_NO_KEYBOARD).toBeTruthy();
    expect(r & UxRestrictions.UX_RESTRICTIONS_NO_VIDEO).toBeTruthy();
    expect(activeUxRestrictions("PARKED")).toBe(0);
    expect(screenBudget("DRIVING").maxLines).toBe(2);
    expect(screenBudget("STOPPED").showReplyLine).toBe(true);
  });
});

describe("지연 판단 (predictDelayMin · shouldAskDelay)", () => {
  it("ETA − 약속 = 지연 분", () => {
    expect(predictDelayMin(parseHHMM("11:22"), parseHHMM("11:00"))).toBe(22);
    expect(predictDelayMin(parseHHMM("10:55"), parseHHMM("11:00"))).toBe(-5);
  });
  it("기준 10분: 9분은 안 묻고 10분은 묻는다 (경계값)", () => {
    expect(shouldAskDelay(9, null, null, R)).toBe(false);
    expect(shouldAskDelay(10, null, null, R)).toBe(true);
  });
  it("이미 22분 알렸으면 31분은 안 묻고 32분부터 다시 묻는다", () => {
    expect(shouldAskDelay(31, 22, null, R)).toBe(false);
    expect(shouldAskDelay(32, 22, null, R)).toBe(true);
  });
  it("운전자가 「아니」 한 값도 기준이 된다 (졸라 대지 않기)", () => {
    expect(shouldAskDelay(40, 22, 35, R)).toBe(false);
    expect(shouldAskDelay(45, 22, 35, R)).toBe(true);
  });
  it("고객 문구는 5분 단위, 최소 5분", () => {
    expect(delayForMessage(22)).toBe(20);
    expect(delayForMessage(23)).toBe(25);
    expect(delayForMessage(2)).toBe(5);
  });
});

describe("시간 창 (고객에게는 분 단위 범위만)", () => {
  it("11:22 → 11:20~11:30", () => {
    expect(etaWindow(parseHHMM("11:22"))).toEqual({ from: parseHHMM("11:20"), to: parseHHMM("11:30") });
    expect(fmtWindow(parseHHMM("11:22"))).toBe("11:20~11:30");
  });
  it("정각 경계 11:00 → 11:00~11:10, 잘못된 시각은 오류", () => {
    expect(fmtWindow(660)).toBe("11:00~11:10");
    expect(fmtHHMM(659.99)).toBe("10:59");
    expect(() => parseHHMM("25:00")).toThrow();
  });
});

describe("도착 전 확인 · 주차장 높이", () => {
  it("남은 10분(600초)이면 확인, 601초면 아직 (경계값)", () => {
    expect(shouldPreArrivalCheck({ remainTimeSec: 600, remainDistM: 9000, alreadySent: false }, R)).toBe(true);
    expect(shouldPreArrivalCheck({ remainTimeSec: 601, remainDistM: 9000, alreadySent: false }, R)).toBe(false);
  });
  it("남은 3km 이하이면 시간과 무관하게 확인, 이미 보냈으면 다시 안 보냄", () => {
    expect(shouldPreArrivalCheck({ remainTimeSec: 1500, remainDistM: 3000, alreadySent: false }, R)).toBe(true);
    expect(shouldPreArrivalCheck({ remainTimeSec: 300, remainDistM: 2000, alreadySent: true }, R)).toBe(false);
  });
  it("남은 1분 이하는 사실상 도착 — 묻지 않음", () => {
    expect(shouldPreArrivalCheck({ remainTimeSec: 60, remainDistM: 300, alreadySent: false }, R)).toBe(false);
  });
  it("PV5 전고 1,905mm는 2.1m 지하주차장 진입 가능, 2.0m는 불가 (여유 100mm)", () => {
    expect(canEnterUnderground(1905, 2100)).toBe(true);
    expect(canEnterUnderground(1905, 2005)).toBe(true);
    expect(canEnterUnderground(1905, 2000)).toBe(false);
    expect(canEnterUnderground(2550, 2300)).toBe(false); // 일반 택배 탑차 2.5~2.6m
    expect(canEnterUnderground(1905, null)).toBe(false);
    expect(heightLabel(1905)).toBe("1.9m");
  });
});

describe("방문 상태 머신", () => {
  it("도착(기어 P) → 뒷문 열림 → 출발 순서로만 진행", () => {
    let s = nextJobStatus("SCHEDULED", "ROUTE_STARTED");
    expect(s).toBe("EN_ROUTE");
    s = nextJobStatus(s, "DELAY_NOTIFIED");
    expect(s).toBe("DELAY_NOTIFIED");
    s = nextJobStatus(s, "ARRIVED_AND_PARKED");
    expect(s).toBe("ARRIVED");
    s = nextJobStatus(s, "REAR_DOOR_OPENED");
    expect(s).toBe("IN_PROGRESS");
    s = nextJobStatus(s, "DEPARTED");
    expect(s).toBe("DONE");
  });
  it("도착 전 뒷문 열림·완료 후 미루기는 무시", () => {
    expect(nextJobStatus("EN_ROUTE", "REAR_DOOR_OPENED")).toBe("EN_ROUTE");
    expect(nextJobStatus("DONE", "POSTPONED")).toBe("DONE");
    expect(nextJobStatus("IN_PROGRESS", "OTHER_DAY")).toBe("IN_PROGRESS");
  });
});

describe("재배치 (replan)", () => {
  const jobs: PlanJob[] = [
    { id: "A", seq: 1, promisedMin: parseHHMM("11:00"), estWorkMin: 50, status: "DELAY_NOTIFIED" },
    { id: "B", seq: 2, promisedMin: parseHHMM("11:40"), estWorkMin: 40, status: "SCHEDULED" },
    { id: "C", seq: 3, promisedMin: parseHHMM("13:30"), estWorkMin: 70, status: "SCHEDULED" },
  ];
  const travel = () => 20;
  it("A가 「1시간 뒤로」 → 12:00, 순서 B > A > C, B에게 앞당김 문의", () => {
    const a2 = applyReply(jobs[0], "POSTPONE_60");
    expect(a2.promisedMin).toBe(parseHHMM("12:00"));
    expect(a2.status).toBe("POSTPONED");
    const r = replan({ jobs: [a2, jobs[1], jobs[2]], startMin: parseHHMM("10:40"), travelFromHere: () => 21, travel, earlierOfferMin: 15 });
    expect(r.order).toEqual(["B", "A", "C"]);
    expect(r.offer).toEqual({ jobId: "B", etaMin: parseHHMM("11:01") });
  });
  it("「다른 날로」 → 오늘 순서에서 빠짐", () => {
    const a2 = applyReply(jobs[0], "OTHER_DAY");
    const r = replan({ jobs: [a2, jobs[1], jobs[2]], startMin: parseHHMM("10:40"), travelFromHere: () => 21, travel, earlierOfferMin: 15 });
    expect(r.order).toEqual(["B", "C"]);
  });
  it("14분 일찍이면 앞당김 문의 없음, 15분이면 있음 (경계값)", () => {
    const only = [jobs[1]];
    const r14 = replan({ jobs: only, startMin: parseHHMM("11:00"), travelFromHere: () => 26, travel, earlierOfferMin: 15 });
    expect(r14.offer).toBeNull();
    const r15 = replan({ jobs: only, startMin: parseHHMM("11:00"), travelFromHere: () => 25, travel, earlierOfferMin: 15 });
    expect(r15.offer?.etaMin).toBe(parseHHMM("11:25"));
  });
  it("「좋아요」면 약속을 제안 시각으로 확정, 「기다릴게요」는 그대로", () => {
    expect(applyReply(jobs[1], "OK_EARLIER", parseHHMM("11:01")).promisedMin).toBe(parseHHMM("11:01"));
    expect(applyReply(jobs[0], "WAIT")).toEqual(jobs[0]);
  });
  it("내비에는 다음 1곳 + 그다음 1곳만 — 경유지 최대 2개를 넘지 않는다", () => {
    expect(naviTargets(["B", "A", "C", "D"])).toEqual({ destination: "B", lookahead: "A" });
    expect(naviTargets([])).toEqual({ destination: null, lookahead: null });
    expect(MAX_WAYPOINTS).toBe(2);
  });
});

describe("작업 시간 초과 예측 (C7)", () => {
  it("예정 안이면 다음 고객 지연 없음", () => {
    const r = predictOverrun({ workStartedMin: parseHHMM("11:00"), estWorkMin: 40, nowMin: parseHHMM("11:20"), travelToNextMin: 20, nextPromisedMin: parseHHMM("12:00"), minRemainWorkMin: 10 });
    expect(r.projectedEndMin).toBe(parseHHMM("11:40"));
    expect(r.nextDelayMin).toBe(0);
  });
  it("11:41이면 최소 10분 더 → 11:51 끝, 다음 고객 +11분", () => {
    const r = predictOverrun({ workStartedMin: parseHHMM("11:00"), estWorkMin: 40, nowMin: parseHHMM("11:41"), travelToNextMin: 20, nextPromisedMin: parseHHMM("12:00"), minRemainWorkMin: 10 });
    expect(r.projectedEndMin).toBe(parseHHMM("11:51"));
    expect(r.nextDelayMin).toBe(11);
  });
});

describe("음성 의도 · Gleo App Schema", () => {
  it("「그래」「응 보내」= YES, 「아니 됐어」= NO", () => {
    expect(matchVoiceIntent("그래")).toBe("YES");
    expect(matchVoiceIntent("응 보내 줘")).toBe("YES");
    expect(matchVoiceIntent("아니 됐어")).toBe("NO");
    expect(matchVoiceIntent("   ")).toBeNull();
  });
  it("구체 명령이 먼저: 다음 어디야 / 주차장 입구로 바꿔 / 늦는다고 알려 줘", () => {
    expect(matchVoiceIntent("다음 어디야?")).toBe("READ_NEXT_JOB");
    expect(matchVoiceIntent("주차장 입구로 바꿔")).toBe("CHANGE_TO_PARKING");
    expect(matchVoiceIntent("늦는다고 알려 줘")).toBe("NOTIFY_DELAY");
  });
  it("앱의 App Schema는 규칙 통과 (actionCalls ≤ 3, 대문자_밑줄, 영어 description)", () => {
    expect(validateAppSchema(schema)).toEqual([]);
    expect(schema.actionCalls.length).toBeLessThanOrEqual(MAX_ACTION_CALLS);
  });
  it("함수 4개·소문자 이름·한국어 설명은 걸러낸다", () => {
    const bad = JSON.parse(JSON.stringify(schema)) as AppSchema;
    bad.actionCalls.push({ ...bad.actionCalls[0], function: { ...bad.actionCalls[0].function, name: "notifyDelay", description: "지연 알림" } });
    const errs = validateAppSchema(bad);
    expect(errs.some((e) => e.includes("최대 3개"))).toBe(true);
    expect(errs.some((e) => e.includes("대문자_밑줄"))).toBe(true);
    expect(errs.some((e) => e.includes("영어"))).toBe(true);
  });
});

describe("이동 시간표 · 정체 계수", () => {
  it("대칭이고, 주차장 입구는 소속 방문지 + 1분", () => {
    expect(travelBaseMin("J1", "J2")).toBe(32);
    expect(travelBaseMin("J2", "J1")).toBe(32);
    expect(travelBaseMin("J2", "J4_PB")).toBe(26);
    expect(travelBaseMin("J4", "J4_PB")).toBe(1);
  });
  it("시간대 계수: 10:59 = 1.0, 11:00 = 1.1, 17:00 = 1.4 (경계값)", () => {
    expect(hourFactor(parseHHMM("10:59"))).toBe(1.0);
    expect(hourFactor(parseHHMM("11:00"))).toBe(1.1);
    expect(hourFactor(parseHHMM("17:00"))).toBe(1.4);
    expect(travelMin("J3", "J2", parseHHMM("11:41"))).toBe(20);
  });
  it("구간 위 위치에서 다른 방문지까지는 양 끝 보간", () => {
    expect(travelFromLegBase("J1", "J2", 0, "J3")).toBe(22);
    expect(travelFromLegBase("J1", "J2", 1, "J3")).toBe(18);
    expect(travelFromLegBase("J1", "J2", 0.5, "J2")).toBe(16);
  });
});

describe("개인정보 — 고객 화면 데이터", () => {
  it("위치(위·경도·지점 ID)를 담지 않고 도착 예정 범위만 준다", () => {
    const job = { ...initialJobs()[1], status: "DELAY_NOTIFIED" as const, etaMin: parseHHMM("11:22") };
    const v = toCustomerView(job, blankSession(), [], parseHHMM("10:40"));
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/lat|lng|latitude|longitude|nodeId|"x"|"y"/);
    expect(v.etaText).toBe("11:20~11:30");
    expect(v.stage).toBe("이동 중");
  });
});
