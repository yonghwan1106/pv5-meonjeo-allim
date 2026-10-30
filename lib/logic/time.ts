/** 시간 도우미 — 모든 판단 로직은 「하루의 분(minute of day)」 숫자로 계산한다. */

export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`시각 형식 오류: ${s}`);
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new Error(`시각 범위 오류: ${s}`);
  return h * 60 + mi;
}

export function fmtHHMM(min: number): string {
  const total = Math.floor(min + 1e-9);
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 한국어 읽기용 「11시 5분」 */
export function speakHHMM(min: number): string {
  const total = Math.floor(min + 1e-9);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return m === 0 ? `${h}시` : `${h}시 ${m}분`;
}

export function floorTo(n: number, step: number): number {
  return Math.floor(n / step) * step;
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/**
 * 고객에게 보여 줄 도착 예정 「범위」(분 단위). 정확한 위치·분초 대신 10분 폭 창만 준다.
 * 예: 11:22 → 11:20~11:30
 */
export function etaWindow(etaMin: number, widthMin = 10): { from: number; to: number } {
  const from = floorTo(Math.floor(etaMin), 5);
  return { from, to: from + widthMin };
}

export function fmtWindow(etaMin: number): string {
  const w = etaWindow(etaMin);
  return `${fmtHHMM(w.from)}~${fmtHHMM(w.to)}`;
}

export const secToMin = (s: number) => s / 60;
