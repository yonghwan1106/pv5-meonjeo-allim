/** 시연 날짜 기준 epoch 변환 — TripInfo.eta 는 epoch ms [가정]으로 주고받는다. */
import day from "../../data/day.json";

export const DAY_BASE_MS = Date.parse(`${day.dayDate}T00:00:00+09:00`);

export function minToEpochMs(min: number): number {
  return DAY_BASE_MS + Math.round(min * 60_000);
}

export function epochMsToMin(ms: number): number {
  return (ms - DAY_BASE_MS) / 60_000;
}
