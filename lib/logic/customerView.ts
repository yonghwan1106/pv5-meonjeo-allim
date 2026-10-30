/**
 * 고객 화면(1회용 링크)에 내보낼 데이터만 고른다 — 순수 함수.
 * 원칙: 기사·차량의 위치(지도·위경도·지점 ID)는 절대 넣지 않는다. 도착 예정 「범위」(분 단위)만.
 */
import type { CustomerSession, Job, Notice } from "../engine/types";
import { fmtHHMM, fmtWindow } from "./time";
import type { JobStatus } from "./jobState";

export const STAGES = ["출발 전", "이동 중", "도착", "작업 중", "완료"] as const;

export function stageOf(status: JobStatus): { stage: string; index: number } {
  switch (status) {
    case "SCHEDULED":
      return { stage: "출발 전", index: 0 };
    case "POSTPONED":
      return { stage: "출발 전", index: 0 };
    case "EN_ROUTE":
    case "DELAY_NOTIFIED":
      return { stage: "이동 중", index: 1 };
    case "ARRIVED":
      return { stage: "도착", index: 2 };
    case "IN_PROGRESS":
      return { stage: "작업 중", index: 3 };
    case "DONE":
      return { stage: "완료", index: 4 };
    case "OTHER_DAY":
      return { stage: "다른 날로 변경", index: -1 };
  }
}

export interface CustomerView {
  alias: string;
  work: string;
  place: string;
  stage: string;
  stageIndex: number;
  promisedText: string;
  etaText: string | null;
  messages: { id: number; body: string; at: string; template: Notice["template"] }[];
  pending: CustomerSession["pending"];
  home: CustomerSession["home"];
  parking: CustomerSession["parking"];
  workStartedText: string | null;
}

export function toCustomerView(job: Job, session: CustomerSession, notices: Notice[], _nowMin: number): CustomerView {
  const st = stageOf(job.status);
  const moving = job.status === "EN_ROUTE" || job.status === "DELAY_NOTIFIED";
  return {
    alias: job.customerAlias,
    work: job.work,
    place: job.place,
    stage: st.stage,
    stageIndex: st.index,
    promisedText: fmtHHMM(job.promisedMin),
    etaText: moving && job.etaMin !== null ? fmtWindow(job.etaMin) : null,
    messages: notices
      .filter((n) => n.jobId === job.id)
      .slice(-6)
      .map((n) => ({ id: n.id, body: n.body, at: fmtHHMM(n.sentAtSec / 60), template: n.template })),
    pending: session.pending,
    home: session.home,
    parking: session.parking,
    workStartedText: job.workStartedAt !== null ? fmtHHMM(job.workStartedAt) : null,
  };
}
