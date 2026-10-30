/** 차량 화면 상태 C0~C8 판정 (S1 B-1 표) — 화면은 이 코드만 보고 그린다. */
import type { EngineState, Job } from "./types";

export type CarCode = "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8";

export const CAR_CODE_LABEL: Record<CarCode, string> = {
  C0: "출발 전",
  C1: "주행",
  C2: "지연 묻기",
  C3: "고객 응답",
  C4: "순서 재배치",
  C5: "10분 전 확인",
  C6: "도착",
  C7: "작업 중",
  C8: "하루 끝",
};

const RECENT_SEC = 240;

export function currentJob(s: EngineState): Job | undefined {
  return s.server.jobs.find((j) => j.id === s.app.currentJobId);
}

export function carScreenCode(s: EngineState): CarCode {
  const app = s.app;
  const jobs = s.server.jobs;
  if (s.server.dayEnded || (app.mode === "PARKED" && jobs.every((j) => j.status === "DONE" || j.status === "OTHER_DAY"))) return "C8";
  if (app.gleo) {
    if (app.gleo.reason === "PARKING") return "C5";
    if (app.gleo.reason === "OVERRUN") return "C7";
    return "C2";
  }
  const cur = currentJob(s);
  if (cur?.status === "IN_PROGRESS") return "C7";
  if (cur?.status === "ARRIVED") return "C6";
  if (!app.route && app.mode === "PARKED") return "C0";
  const b = app.banner;
  if (b && s.clockSec - b.atSec < RECENT_SEC) {
    if (b.kind === "REORDER") return "C4";
    if (b.kind === "PRE_ARRIVAL" || b.kind === "PARKING") return "C5";
  }
  const c = app.chip;
  if (c && app.replyLine && s.clockSec - c.atSec < RECENT_SEC && c.text.includes(":")) return "C3";
  return "C1";
}

/** 주행 화면 상태 칩 1개: 가장 최근의 배너/칩 */
export function statusLine(s: EngineState): { text: string; tone: "ok" | "warn" | "info" | "danger" } | null {
  const b = s.app.banner;
  const c = s.app.chip;
  const bOk = b && s.clockSec - b.atSec < RECENT_SEC * 3;
  const cOk = c && s.clockSec - c.atSec < RECENT_SEC * 3;
  if (bOk && (!cOk || b!.atSec >= c!.atSec)) return { text: b!.text, tone: b!.kind === "REORDER" ? "warn" : "ok" };
  if (cOk) return { text: c!.text, tone: c!.tone };
  return null;
}
