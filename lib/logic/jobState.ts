/**
 * 방문(Job) 상태 머신 — 차량 신호·고객 응답 사건으로만 바뀐다 (기능 3 「기사는 아무것도 누르지 않는다」).
 *
 *  SCHEDULED ─ROUTE_STARTED→ EN_ROUTE ─DELAY_NOTIFIED→ DELAY_NOTIFIED
 *      │                         └──────ARRIVED_AND_PARKED (onDestinationArrived + 기어 P)──→ ARRIVED
 *      │                                                         ARRIVED ─REAR_DOOR_OPENED→ IN_PROGRESS
 *      │                                                 ARRIVED/IN_PROGRESS ─DEPARTED (기어 D + 차속>0)→ DONE
 *      └─POSTPONED→ POSTPONED (다시 ROUTE_STARTED 가능)        * ─OTHER_DAY→ OTHER_DAY
 */
export type JobStatus =
  | "SCHEDULED"
  | "EN_ROUTE"
  | "DELAY_NOTIFIED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "DONE"
  | "POSTPONED"
  | "OTHER_DAY";

export type JobEvent =
  | "ROUTE_STARTED"
  | "ROUTE_REPLACED"
  | "DELAY_NOTIFIED"
  | "ARRIVED_AND_PARKED"
  | "REAR_DOOR_OPENED"
  | "DEPARTED"
  | "POSTPONED"
  | "OTHER_DAY";

export const TERMINAL_STATUSES: JobStatus[] = ["DONE", "OTHER_DAY"];
export const ON_SITE_STATUSES: JobStatus[] = ["ARRIVED", "IN_PROGRESS"];
export const PLANNABLE_STATUSES: JobStatus[] = ["SCHEDULED", "EN_ROUTE", "DELAY_NOTIFIED", "POSTPONED"];

export function nextJobStatus(s: JobStatus, e: JobEvent): JobStatus {
  switch (e) {
    case "ROUTE_STARTED":
      return s === "SCHEDULED" || s === "POSTPONED" ? "EN_ROUTE" : s;
    case "ROUTE_REPLACED":
      return s === "EN_ROUTE" ? "SCHEDULED" : s;
    case "DELAY_NOTIFIED":
      return s === "SCHEDULED" || s === "EN_ROUTE" || s === "POSTPONED" ? "DELAY_NOTIFIED" : s;
    case "ARRIVED_AND_PARKED":
      return s === "EN_ROUTE" || s === "DELAY_NOTIFIED" || s === "POSTPONED" ? "ARRIVED" : s;
    case "REAR_DOOR_OPENED":
      return s === "ARRIVED" ? "IN_PROGRESS" : s;
    case "DEPARTED":
      return s === "ARRIVED" || s === "IN_PROGRESS" ? "DONE" : s;
    case "POSTPONED":
      return PLANNABLE_STATUSES.includes(s) ? "POSTPONED" : s;
    case "OTHER_DAY":
      return PLANNABLE_STATUSES.includes(s) ? "OTHER_DAY" : s;
  }
}

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  SCHEDULED: "예정",
  EN_ROUTE: "이동 중",
  DELAY_NOTIFIED: "이동 중 · 지연 알림",
  ARRIVED: "도착",
  IN_PROGRESS: "작업 중",
  DONE: "완료",
  POSTPONED: "시간 변경",
  OTHER_DAY: "다른 날로",
};
