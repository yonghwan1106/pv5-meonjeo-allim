/** 기능 4 — 도착 10분 전 확인과 주차장 진입 가능 판단 (순수 함수). */
import type { Rules } from "./rules";

export function shouldPreArrivalCheck(
  input: { remainTimeSec: number; remainDistM: number; alreadySent: boolean },
  rules: Pick<Rules, "preArrivalMin" | "preArrivalDistM">,
): boolean {
  if (input.alreadySent) return false;
  if (input.remainTimeSec <= 60) return false; // 사실상 도착 — 묻기엔 늦음
  return input.remainTimeSec <= rules.preArrivalMin * 60 || input.remainDistM <= rules.preArrivalDistM;
}

/**
 * 차 높이 + 여유(기본 100mm)가 주차장 높이 제한 이하이면 진입 가능.
 * PV5 카고 롱 전고 1,905mm (R0a) → 2.1m(2,100mm) 지하주차장 진입 가능.
 */
export function canEnterUnderground(vehicleHeightMm: number, clearanceMm: number | null, marginMm = 100): boolean {
  if (clearanceMm == null) return false;
  return vehicleHeightMm + marginMm <= clearanceMm;
}

/** 1,905 → "1.9m" */
export function heightLabel(mm: number): string {
  return `${(Math.floor(mm / 100) / 10).toFixed(1)}m`;
}
