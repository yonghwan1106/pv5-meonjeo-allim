/** 기능 1 — 지연 예측과 「물어볼지」 판단 (순수 함수). */
import type { Rules } from "./rules";
import { roundTo } from "./time";

/** 예상 지연(분) = 내비 ETA − 약속 시각. 음수면 일찍 도착. */
export function predictDelayMin(etaMin: number, promisedMin: number): number {
  return Math.round(etaMin - promisedMin);
}

/**
 * 운전자에게 「알릴까요?」를 물을지.
 * - 처음: 지연 ≥ delayThresholdMin
 * - 이미 알렸거나(notified) 운전자가 「아니」라고 했으면(declined): 그 값 + renotifyStepMin 이상 더 밀릴 때만 다시 묻는다
 */
export function shouldAskDelay(
  delayMin: number,
  notifiedMin: number | null | undefined,
  declinedMin: number | null | undefined,
  rules: Pick<Rules, "delayThresholdMin" | "renotifyStepMin">,
): boolean {
  if (delayMin < rules.delayThresholdMin) return false;
  const bases = [notifiedMin, declinedMin].filter((v): v is number => typeof v === "number");
  if (bases.length === 0) return true;
  return delayMin >= Math.max(...bases) + rules.renotifyStepMin;
}

/** 고객 문구용 지연 분 — 5분 단위 반올림, 최소 5분 */
export function delayForMessage(delayMin: number): number {
  return Math.max(5, roundTo(delayMin, 5));
}
