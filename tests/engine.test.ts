import { describe, expect, it } from "vitest";
import { DemoEngine } from "@/lib/engine/engine";
import { SCENARIOS } from "@/lib/engine/scenarios";
import { fmtHHMM } from "@/lib/logic/time";

function runToEnd(id: string): DemoEngine {
  const e = new DemoEngine();
  e.dispatch({ type: "ctl.load", scenarioId: id });
  const sc = SCENARIOS.find((s) => s.id === id)!;
  e.dispatch({ type: "ctl.speed", speed: 60 });
  e.dispatch({ type: "ctl.play" });
  // 실시간 100ms씩 최대 10분 분량 — 끝까지 예외 없이 돌아야 한다
  for (let i = 0; i < 6000 && (e.s.playing || e.s.scenario.stepIndex < sc.steps.length - 1); i++) e.tick(100);
  return e;
}

const job = (e: DemoEngine, id: string) => e.s.server.jobs.find((j) => j.id === id)!;
const notices = (e: DemoEngine, id: string) => e.s.server.notices.filter((n) => n.jobId === id).map((n) => n.template);

describe("시나리오 자동 재생 — 끝까지 예외 없음", () => {
  for (const sc of SCENARIOS) {
    it(`${sc.short} 재생 완료`, () => {
      const e = runToEnd(sc.id);
      expect(e.s.scenario.stepIndex).toBe(sc.steps.length - 1);
      expect(e.s.scenario.finished).toBe(true);
      if (sc.id !== "FREE") expect(e.s.playing).toBe(false); // 자유 조작은 계속 흐른다
      expect(JSON.parse(JSON.stringify(e.s))).toBeTruthy(); // 직렬화 가능 (탭 동기화)
    });
  }
});

describe("시나리오 결과", () => {
  it("① 지연: 「그래」로 김○○에게 지연 알림 1건, 두 번째 질문은 「아니」라 안 보냄", () => {
    const e = runToEnd("S1");
    expect(notices(e, "J2").filter((t) => t === "DELAY")).toHaveLength(1);
    expect(e.s.server.notices.find((n) => n.template === "DELAY")!.body).toContain("11:20~11:30");
    expect(e.s.server.sessions["J2"].lastReply).toBe("WAIT");
    expect(e.s.app.declined["J2"]).toBeGreaterThanOrEqual(32);
    expect(e.s.server.timeline.some((t) => t.kind === "DECLINED")).toBe(true);
    expect(e.s.log.some((l) => l.name === "터치 입력 막음")).toBe(true);
  });

  it("② 재배치: 김○○ 12:00으로, 내비 목적지는 박○○, 박○○ 앞당김 수락", () => {
    const e = runToEnd("S2");
    expect(fmtHHMM(job(e, "J2").promisedMin)).toBe("12:00");
    expect(e.s.server.order.slice(0, 2)).toEqual(["J3", "J2"]);
    expect(e.s.app.route?.jobId).toBe("J3");
    expect(e.s.world.leg?.to).toBe("J3");
    expect(notices(e, "J3")).toContain("RESCHEDULE_OFFER");
    expect(e.s.server.sessions["J3"].lastReply).toBe("OK_EARLIER");
    expect(e.s.log.some((l) => l.name.startsWith("GLEO") || l.name.includes("READ_NEXT_JOB"))).toBe(true);
  });

  it("③ 도착·작업·출발: 기어 P에서만 도착, 뒷문 = 작업 시작, 기어 D = 완료, 작업 초과 미리 알림", () => {
    const e = runToEnd("S3");
    const j3 = job(e, "J3");
    expect(j3.status).toBe("DONE");
    expect(j3.arrivedAt).not.toBeNull();
    expect(j3.workStartedAt).not.toBeNull();
    expect(notices(e, "J3")).toEqual(expect.arrayContaining(["ARRIVED", "WORK_STARTED", "WORK_DONE"]));
    const delays = e.s.server.notices.filter((n) => n.jobId === "J2" && n.template === "DELAY");
    expect(delays.at(-1)!.approvedBy).toBe("TOUCH");
    expect(notices(e, "J2")).toContain("DEPARTED_TO_YOU");
    expect(e.s.app.route?.jobId).toBe("J2");
  });

  it("④ 10분 전 확인·주차장: 「집에 계세요?」 → 입구 교체 → 입구에서 도착", () => {
    const e = runToEnd("S4");
    const j4 = job(e, "J4");
    expect(notices(e, "J4")).toEqual(expect.arrayContaining(["PRE_ARRIVAL_CHECK", "PARKING_OK", "ARRIVED"]));
    expect(j4.parkingEntranceId).toBe("J4_PB");
    expect(j4.status).toBe("ARRIVED");
    expect(e.s.world.at).toBe("J4_PB");
    expect(e.s.server.sessions["J4"].home).toBe("YES");
  });

  it("단계 이동: 다음/이전/점프가 같은 결과를 낸다 (결정적 재생)", () => {
    const a = new DemoEngine();
    a.dispatch({ type: "ctl.load", scenarioId: "S2" });
    for (let i = 0; i < 4; i++) a.dispatch({ type: "ctl.next" });
    const b = new DemoEngine();
    b.dispatch({ type: "ctl.load", scenarioId: "S2" });
    b.dispatch({ type: "ctl.jump", index: 4 });
    expect(b.s.server.order).toEqual(a.s.server.order);
    expect(b.s.clockSec).toBe(a.s.clockSec);
    b.dispatch({ type: "ctl.prev" });
    expect(b.s.scenario.stepIndex).toBe(3);
  });

  it("스냅샷으로 다른 탭이 이어받아도 같은 흐름 (BroadcastChannel 인계)", () => {
    const a = new DemoEngine();
    a.dispatch({ type: "ctl.load", scenarioId: "S1" });
    a.dispatch({ type: "ctl.next" });
    const b = new DemoEngine(JSON.parse(JSON.stringify(a.s)));
    expect(b.s.app.gleo?.functionName).toBe("NOTIFY_DELAY");
    b.dispatch({ type: "voice.yes" });
    expect(b.s.server.notices.some((n) => n.template === "DELAY")).toBe(true);
  });

  it("7초 무응답 → 한 번 더 묻고, 또 무응답이면 보내지 않음", () => {
    const e = new DemoEngine();
    e.dispatch({ type: "ctl.load", scenarioId: "S1" });
    e.dispatch({ type: "ctl.next" });
    expect(e.s.app.gleo).not.toBeNull();
    e.dispatch({ type: "ctl.pause" });
    // 일시정지 중에는 타이머가 흐르지 않는다
    for (let i = 0; i < 100; i++) e.tick(100);
    expect(e.s.app.gleo).not.toBeNull();
    // 재생 중 hold 동안 7초 + 7초
    e.s.holdMs = 60_000;
    e.dispatch({ type: "ctl.play" });
    for (let i = 0; i < 71; i++) e.tick(100);
    expect(e.s.app.gleo?.retried).toBe(true);
    for (let i = 0; i < 71; i++) e.tick(100);
    expect(e.s.app.gleo).toBeNull();
    expect(e.s.server.notices.some((n) => n.template === "DELAY")).toBe(false);
  });

  it("자유 조작: 주차 중 「첫 고객으로 출발」 → 움직이면 「출발했어요」 발송, 하루 마무리 요약", () => {
    const e = new DemoEngine();
    e.dispatch({ type: "ctl.load", scenarioId: "FREE" });
    e.dispatch({ type: "car.tap", button: "START_FIRST" });
    expect(e.s.app.route?.jobId).toBe("J1");
    expect(notices(e, "J1")).not.toContain("DEPARTED_TO_YOU");
    e.dispatch({ type: "sim.speed", kmh: 40 });
    expect(notices(e, "J1")).toContain("DEPARTED_TO_YOU");
    e.dispatch({ type: "day.finish" });
    expect(e.s.server.dayEnded).toBe(true);
    expect(e.s.server.jobs.every((j) => j.status === "DONE")).toBe(true);
  });
});
