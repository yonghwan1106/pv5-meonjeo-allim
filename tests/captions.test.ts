import { describe, expect, it } from "vitest";
import { DemoEngine } from "@/lib/engine/engine";
import { SCENARIOS } from "@/lib/engine/scenarios";
import { NA, captionVarNames, fillCaption, fmtDiff, shownDiffMin } from "@/lib/engine/captionVars";
import { fmtHHMM, fmtWindow, speakHHMM } from "@/lib/logic/time";

const KEYS = ["title", "signal", "decision", "driver", "companion"] as const;

function at(id: string, step: number): DemoEngine {
  const e = new DemoEngine();
  e.dispatch({ type: "ctl.load", scenarioId: id });
  for (let i = 0; i < step; i++) e.dispatch({ type: "ctl.next" });
  expect(e.s.scenario.stepIndex).toBe(step);
  return e;
}

const caption = (e: DemoEngine) => {
  const sc = SCENARIOS.find((x) => x.id === e.s.scenario.id)!;
  const c = sc.steps[e.s.scenario.stepIndex].caption;
  return Object.fromEntries(KEYS.map((k) => [k, fillCaption(c[k], e.s)])) as Record<(typeof KEYS)[number], string>;
};

describe("자막 숫자 = 엔진 값 (하드코딩 금지)", () => {
  for (const sc of SCENARIOS) {
    it(`${sc.short}: 모든 단계의 변수가 값으로 채워진다 (「값 없음」·「{」 없음), 단계 제목엔 변수 없음`, () => {
      for (let i = 0; i < sc.steps.length; i++) {
        expect(captionVarNames(sc.steps[i].caption.title)).toEqual([]);
        const c = caption(at(sc.id, i));
        for (const k of KEYS) {
          expect(c[k], `${sc.id} 단계 ${i} ${k}`).not.toContain(NA);
          expect(c[k], `${sc.id} 단계 ${i} ${k}`).not.toMatch(/\{[a-zA-Z]/);
        }
      }
    });
  }

  it("① 단계 6: 자막의 TripInfo.eta·지연이 차량 화면 표기와 같다 (11:35쯤 vs 11:34 문제)", () => {
    const e = at("S1", 6);
    const trip = e.s.app.trip!;
    const j2 = e.s.server.jobs.find((j) => j.id === "J2")!;
    const c = caption(e);
    expect(c.signal).toContain(`TripInfo.eta ${fmtHHMM(trip.etaMin)}`);
    expect(c.signal).toContain(fmtDiff(shownDiffMin(trip.etaMin, j2.promisedMin)));
    expect(c.driver).toContain(e.s.app.gleo!.promptKo);
  });

  it("② 단계 1: 「지금 가면 … 도착(N분 일찍)」이 차량 화면 값과 같다 (40분 vs 39분 문제)", () => {
    const e = at("S2", 1);
    const trip = e.s.app.trip!;
    const j3 = e.s.server.jobs.find((j) => j.id === "J3")!;
    const c = caption(e);
    expect(c.decision).toContain(`${fmtHHMM(trip.etaMin)} 도착(${-shownDiffMin(trip.etaMin, j3.promisedMin)}분 일찍)`);
    expect(c.companion).toContain(fmtWindow(j3.notifiedEtaMin!));
  });

  it("② 단계 2: 앞당김 수락 → 약속 = 고객이 받은 범위의 시작 (11:02가 아니라 11:00)", () => {
    const e = at("S2", 2);
    const j3 = e.s.server.jobs.find((j) => j.id === "J3")!;
    expect(fmtHHMM(j3.promisedMin)).toBe("11:00");
    expect(fmtWindow(j3.notifiedEtaMin!)).toBe("11:00~11:10");
    expect(caption(e).decision).toContain("11:00");
  });

  it("③ 단계 4: Gleo 음성 시각 = 차량 카드 시각 (12:09 vs 12:11 문제) — 물은 값은 답할 때까지 고정", () => {
    const e = at("S3", 4);
    const o = e.s.app.overrun!;
    expect(o).toBeTruthy();
    expect(e.s.app.gleo!.promptKo).toContain(`${speakHHMM(o.etaMin)}쯤`);
    const lastGleo = [...e.s.speech].reverse().find((x) => x.source === "GLEO")!;
    expect(lastGleo.text).toContain(`${speakHHMM(o.etaMin)}쯤`);
    // 시간이 더 흘러도(일시정지 해제 없이 다음 판단 주기를 지나도) 카드 값은 그대로
    const before = o.etaMin;
    (e as unknown as { advanceClock(d: number): void }).advanceClock(90);
    expect(e.s.app.overrun?.etaMin ?? before).toBe(before);
    expect(caption(e).driver).toContain(`${fmtHHMM(before)}쯤`);
  });

  it("③ 단계 5: 고객에게 간 문구 = 자막 (범위·분)", () => {
    const e = at("S3", 5);
    const body = [...e.s.server.notices].reverse().find((n) => n.jobId === "J2" && n.template === "DELAY")!.body;
    const c = caption(e);
    const j2 = e.s.server.jobs.find((j) => j.id === "J2")!;
    expect(body).toContain(fmtWindow(j2.notifiedEtaMin!));
    expect(c.companion).toContain(fmtWindow(j2.notifiedEtaMin!));
  });
});
