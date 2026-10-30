/**
 * 기능 2 — 고객 응답 → 오늘 남은 순서 다시 짜기 (순수 함수).
 *
 * 내비(NaviHelper) 경유지는 최대 2개라 하루 일정을 통째로 넣지 않는다.
 * 하루 계획은 앱·서버가 들고, 내비에는 「다음 1곳」을 목적지로만 넘긴다(naviTargets).
 */
import { MAX_WAYPOINTS } from "../pleos/naviHelper";
import { PLANNABLE_STATUSES, nextJobStatus, type JobStatus } from "./jobState";
import { etaWindow } from "./time";

export type CustomerReply =
  | "WAIT"
  | "POSTPONE_30"
  | "POSTPONE_60"
  | "OTHER_DAY"
  | "OK_EARLIER"
  | "KEEP_ORIGINAL"
  | "HOME_YES"
  | "HOME_LATER_30"
  | "HOME_NO";

export interface PlanJob {
  id: string;
  seq: number;
  promisedMin: number;
  estWorkMin: number;
  status: JobStatus;
}

/** 응답을 일정 한 건에 반영 */
export function applyReply<T extends PlanJob>(job: T, reply: CustomerReply, offerEtaMin?: number): T {
  switch (reply) {
    case "POSTPONE_30":
    case "HOME_LATER_30":
      return { ...job, promisedMin: job.promisedMin + 30, status: nextJobStatus(job.status, "POSTPONED") };
    case "POSTPONE_60":
      return { ...job, promisedMin: job.promisedMin + 60, status: nextJobStatus(job.status, "POSTPONED") };
    case "OTHER_DAY":
    case "HOME_NO":
      return { ...job, status: nextJobStatus(job.status, "OTHER_DAY") };
    case "OK_EARLIER":
      // 고객은 「11:00~11:10 사이」라는 범위를 받고 수락했다 → 약속 = 그 범위의 시작(11:01이 아니라 11:00)
      return typeof offerEtaMin === "number" ? { ...job, promisedMin: etaWindow(offerEtaMin).from } : job;
    default:
      return job;
  }
}

export interface ReplanInput<T extends PlanJob> {
  jobs: T[];
  /** 계획 시작 시각(분). 현장 작업 중이면 그 작업이 끝나는 예상 시각 */
  startMin: number;
  /** 지금 위치(또는 현재 현장)에서 각 방문지까지 걸리는 분 */
  travelFromHere: (jobId: string) => number;
  travel: (fromJobId: string, toJobId: string) => number;
  earlierOfferMin: number;
}

export interface ReplanResult {
  order: string[];
  projected: Record<string, number>;
  offer: { jobId: string; etaMin: number } | null;
}

/** 약속 시각 순으로 남은 방문을 줄 세우고, 첫 방문을 크게 앞당길 수 있으면 「앞당김 문의」를 만든다. */
export function replan<T extends PlanJob>(input: ReplanInput<T>): ReplanResult {
  const remaining = input.jobs
    .filter((j) => PLANNABLE_STATUSES.includes(j.status))
    .sort((a, b) => a.promisedMin - b.promisedMin || a.seq - b.seq);

  const projected: Record<string, number> = {};
  let offer: ReplanResult["offer"] = null;
  let t = input.startMin;
  let prev: string | null = null;
  remaining.forEach((j, i) => {
    const tr = prev === null ? input.travelFromHere(j.id) : input.travel(prev, j.id);
    const arrive = t + tr;
    projected[j.id] = arrive;
    let begin = Math.max(arrive, j.promisedMin);
    if (i === 0 && arrive <= j.promisedMin - input.earlierOfferMin) {
      offer = { jobId: j.id, etaMin: arrive };
      begin = arrive;
    }
    t = begin + j.estWorkMin;
    prev = j.id;
  });
  return { order: remaining.map((j) => j.id), projected, offer };
}

/** 내비에 넘길 지점: 다음 1곳(목적지) + 그다음 1곳(앱이 미리 들고 있는 후보). 절대 MAX_WAYPOINTS를 넘기지 않는다. */
export function naviTargets(order: string[]): { destination: string | null; lookahead: string | null } {
  const head = order.slice(0, Math.min(2, MAX_WAYPOINTS));
  return { destination: head[0] ?? null, lookahead: head[1] ?? null };
}

export const REPLY_LABEL: Record<CustomerReply, string> = {
  WAIT: "기다릴게요",
  POSTPONE_30: "30분 뒤로",
  POSTPONE_60: "1시간 뒤로",
  OTHER_DAY: "다른 날로",
  OK_EARLIER: "좋아요(앞당김)",
  KEEP_ORIGINAL: "원래 시간대로",
  HOME_YES: "집에 있어요",
  HOME_LATER_30: "30분 뒤 와 주세요",
  HOME_NO: "오늘은 안 돼요",
};
