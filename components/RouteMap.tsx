"use client";
/** 자체 SVG 노선도 — 지도 API 없이 가상 좌표로 오늘 방문지·진행 구간·차량 위치를 그린다 (기사 화면 전용, 고객에겐 보내지 않음). */
import type { EngineState } from "@/lib/engine/types";
import { NODES, getNode } from "@/lib/logic/travel";
import { fmtHHMM } from "@/lib/logic/time";

export default function RouteMap({ s, dense = false }: { s: EngineState; dense?: boolean }) {
  const jobs = s.server.jobs;
  const leg = s.world.leg;
  const order = s.server.order;
  const p = leg && leg.totalBaseSec > 0 ? Math.min(1, leg.progressBaseSec / leg.totalBaseSec) : 1;
  const from = leg ? getNode(leg.from) : getNode(s.world.at);
  const to = leg ? getNode(leg.to) : getNode(s.world.at);
  const vx = from.x + (to.x - from.x) * p;
  const vy = from.y + (to.y - from.y) * p;
  const showEntrances = leg?.to.startsWith("J4_") || s.app.parkingOffer?.jobId === "J4" || s.world.at.startsWith("J4_");
  const visible = NODES.filter((n) => !n.parentJob || showEntrances);
  // 오늘 남은 순서 연결선
  const chainIds = [leg && !leg.arrived ? leg.to : s.world.at, ...order.map((id) => jobs.find((j) => j.id === id)!.nodeId)];
  const chain = chainIds.filter((v, i, a) => a.indexOf(v) === i).map((id) => getNode(id));

  return (
    <svg viewBox="0 0 100 64" className="h-full w-full" role="img" aria-label="오늘 방문지 노선도 (가상 좌표)">
      <defs>
        <pattern id="grid" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 6 0 L 0 0 0 6" fill="none" stroke="#1a1f25" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="64" fill="#0b0e11" />
      <rect width="100" height="64" fill="url(#grid)" />
      {/* 남은 순서 */}
      <polyline points={chain.map((n) => `${n.x},${n.y}`).join(" ")} fill="none" stroke="#3a4550" strokeWidth="0.7" strokeDasharray="1.6 1.2" />
      {/* 진행 구간 */}
      {leg && !leg.arrived && (
        <>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#2c6474" strokeWidth="2.2" strokeLinecap="round" />
          <line x1={from.x} y1={from.y} x2={vx} y2={vy} stroke="#7cc4d6" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {visible.map((n) => {
        const job = jobs.find((j) => j.id === n.id);
        const done = job && (job.status === "DONE" || job.status === "OTHER_DAY");
        const isTarget = leg?.to === n.id && !leg.arrived;
        const color = n.id === "DEPOT" ? "#a9b1bb" : n.parentJob ? "#f2b75b" : done ? "#4b545e" : isTarget ? "#7cc4d6" : "#d6dade";
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.parentJob ? 1.3 : 1.9} fill={color} stroke="#0b0e11" strokeWidth="0.5" />
            <text x={n.x + 2.4} y={n.y + 0.9} fontSize={dense ? 2.6 : 2.3} fill={done ? "#6b747e" : "#c9ced4"}>
              {job ? `${job.customerAlias} ${fmtHHMM(job.promisedMin)}` : n.short}
              {done ? " ✓" : ""}
            </text>
          </g>
        );
      })}
      {/* 차량 */}
      <g transform={`translate(${vx},${vy})`}>
        <circle r="2.6" fill="#7cc4d6" opacity="0.25" className="pulse" />
        <rect x="-1.9" y="-1.2" width="3.8" height="2.4" rx="0.6" fill="#eceef1" stroke="#7cc4d6" strokeWidth="0.4" />
      </g>
    </svg>
  );
}
