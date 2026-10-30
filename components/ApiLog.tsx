"use client";
/** 「API 호출 기록」 띠 — 어떤 SDK 이벤트·메서드가 언제 불렸는지 (모의 SDK·앱 판단·서버·고객) */
import { useEffect, useRef, useState } from "react";
import type { EngineState, Layer } from "@/lib/engine/types";
import { fmtHHMM } from "@/lib/logic/time";
import { LAYER_STYLE, LayerBadge } from "./ui";

const ALL: Layer[] = ["AAOS", "VEHICLE", "NAVI", "GLEO", "APP", "SERVER", "CUSTOMER", "SIM"];

export default function ApiLog({ s, height = 180 }: { s: EngineState; height?: number }) {
  const [off, setOff] = useState<Set<Layer>>(new Set(["SIM"]));
  const box = useRef<HTMLDivElement>(null);
  const last = s.log.length ? s.log[s.log.length - 1].id : 0;
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [last]);
  const rows = s.log.filter((l) => !off.has(l.layer)).slice(-80);
  return (
    <section className="card flex flex-col" aria-label="API 호출 기록" data-testid="api-log">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-1.5">
        <h3 className="mr-2 text-sm font-bold">API 호출 기록</h3>
        <span className="mr-2 text-[11px] text-muted">모의 SDK가 실제 Pleos 이름 그대로 불림 → 실차에선 이 줄들이 SDK 호출로 바뀜</span>
        {ALL.map((l) => (
          <button
            key={l}
            className="badge"
            style={{ color: LAYER_STYLE[l].color, opacity: off.has(l) ? 0.35 : 1, cursor: "pointer" }}
            onClick={() =>
              setOff((prev) => {
                const n = new Set(prev);
                if (n.has(l)) n.delete(l);
                else n.add(l);
                return n;
              })
            }
            aria-pressed={!off.has(l)}
          >
            {LAYER_STYLE[l].label}
          </button>
        ))}
      </div>
      <div ref={box} className="overflow-y-auto px-2 py-1 font-mono text-[12px] leading-[1.45] scroll-thin" style={{ height }}>
        {rows.map((l) => (
          <div key={l.id} className="flex items-start gap-2 border-b border-[#1b2026] py-[2px]">
            <span className="w-11 shrink-0 tabular-nums text-muted">{fmtHHMM(l.tSec / 60)}</span>
            <LayerBadge layer={l.layer} />
            <span className="shrink-0 font-bold text-[#e5e8eb]">{l.name}</span>
            {l.detail && <span className="min-w-0 text-[#aab3bd]">{l.detail}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
