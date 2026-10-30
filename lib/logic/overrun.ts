/** C7 — 작업이 길어질 때 「다음 고객 지연」을 출발 전에 미리 예측 (순수 함수). */

export interface OverrunInput {
  workStartedMin: number;
  estWorkMin: number;
  nowMin: number;
  travelToNextMin: number;
  nextPromisedMin: number;
  /** 예정 시간을 넘기면 최소 이만큼 더 걸린다고 본다 */
  minRemainWorkMin: number;
}

export function predictOverrun(i: OverrunInput): { projectedEndMin: number; nextEtaMin: number; nextDelayMin: number } {
  const plannedEnd = i.workStartedMin + i.estWorkMin;
  const projectedEndMin = Math.max(plannedEnd, i.nowMin + i.minRemainWorkMin);
  const nextEtaMin = projectedEndMin + i.travelToNextMin;
  return { projectedEndMin, nextEtaMin, nextDelayMin: Math.round(nextEtaMin - i.nextPromisedMin) };
}
