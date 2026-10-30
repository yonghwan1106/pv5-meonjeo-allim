/** 지점 간 이동 시간표·정체 계수 (모의 데이터 data/day.json) — 순수 함수. */
import day from "../../data/day.json";

export type NodeId = string;

export interface DayNode {
  id: string;
  label: string;
  short: string;
  x: number;
  y: number;
  address: string;
  parentJob?: string;
}

export const NODES: DayNode[] = day.nodes as DayNode[];
const NODE_MAP = new Map(NODES.map((n) => [n.id, n]));
export const getNode = (id: string): DayNode => {
  const n = NODE_MAP.get(id);
  if (!n) throw new Error(`알 수 없는 지점: ${id}`);
  return n;
};

const MATRIX = day.travelMin as Record<string, Record<string, number>>;

/** 주차장 입구 노드는 소속 방문지 + 1분 */
function baseNode(id: string): { id: string; extra: number } {
  const n = NODE_MAP.get(id);
  if (n?.parentJob) return { id: n.parentJob, extra: 1 };
  return { id, extra: 0 };
}

/** 정체 없는 기본 이동 시간(분), 대칭 */
export function travelBaseMin(a: string, b: string): number {
  if (a === b) return 0;
  const A = baseNode(a);
  const B = baseNode(b);
  if (A.id === B.id) return 1;
  const v = MATRIX[A.id]?.[B.id] ?? MATRIX[B.id]?.[A.id];
  if (typeof v !== "number") throw new Error(`이동 시간표에 없음: ${a}→${b}`);
  return v + A.extra + B.extra;
}

/** 시간대 정체 계수 (data/day.json congestionByHour). 표 밖 시간은 1.0 */
export function hourFactor(minOfDay: number): number {
  const h = Math.floor(minOfDay / 60);
  const row = day.congestionByHour.find((r) => h >= r.from && h < r.to);
  return row ? row.factor : 1.0;
}

/** 시간대 계수를 곱한 이동 시간(분) */
export function travelMin(a: string, b: string, atMin: number): number {
  return Math.round(travelBaseMin(a, b) * hourFactor(atMin));
}

/** 구간(from→to) 위 진행률 p 지점에서 target까지 걸리는 기본 분 (양 끝 보간) */
export function travelFromLegBase(from: string, to: string, p: number, target: string): number {
  const q = Math.min(1, Math.max(0, p));
  if (target === to) return travelBaseMin(from, to) * (1 - q);
  return (1 - q) * travelBaseMin(from, target) + q * travelBaseMin(to, target);
}

export function distanceForBaseMin(baseMin: number): number {
  return baseMin * day.metersPerBaseMin;
}

/** 화면에 보여 줄 방문지 간 이동 시간표 */
export function travelTable(ids: string[]): { from: string; to: string; min: number }[] {
  const rows: { from: string; to: string; min: number }[] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) rows.push({ from: ids[i], to: ids[j], min: travelBaseMin(ids[i], ids[j]) });
  return rows;
}

/** 가상 좌표 → 가상 위·경도 (실존 지점과 무관한 계산값) */
export function nodeLatLng(id: string): { lat: number; lng: number } {
  const n = getNode(id);
  return { lat: +(37.2 + n.y / 222).toFixed(6), lng: +(127.0 + n.x / 176).toFixed(6) };
}
