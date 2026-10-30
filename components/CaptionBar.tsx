"use client";
/** 안내 자막 — 단계마다 「차량 신호 변화 → 앱 판단 → 운전자 음성/화면 → 동반 화면 알림」 */
import type { EngineAction, EngineState } from "@/lib/engine/types";
import { getScenario } from "@/lib/engine/scenarios";
import { fillCaption } from "@/lib/engine/captionVars";

const FLOW = [
  { key: "signal", label: "① 차량 신호 변화", color: "#7cc4d6" },
  { key: "decision", label: "② 앱 판단", color: "#f2d38a" },
  { key: "driver", label: "③ 운전자 음성·화면", color: "#c8b6ff" },
  { key: "companion", label: "④ 동반 화면 알림", color: "#ff9fb2" },
] as const;

export default function CaptionBar({ s, dispatch }: { s: EngineState; dispatch: (a: EngineAction) => void }) {
  const sc = getScenario(s.scenario.id);
  const idx = Math.max(0, s.scenario.stepIndex);
  const st = sc.steps[idx];
  const last = idx >= sc.steps.length - 1;
  return (
    <section className="card px-3 py-2" aria-live="polite" data-testid="caption">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge" style={{ color: "var(--accent)" }}>
          {sc.short} · 단계 {idx}/{sc.steps.length - 1}
        </span>
        <h2 className="text-[16px] font-extrabold leading-snug">{fillCaption(st.caption.title, s)}</h2>
        <div className="ml-auto flex items-center gap-1">
          {s.playing && s.holdMs > 0 && <span className="text-[11px] text-muted">읽는 시간 {Math.ceil(s.holdMs / 1000)}초</span>}
          {last ? (
            <span className="text-xs text-muted">시나리오 끝 — 다른 시나리오를 고르거나 직접 눌러 보세요</span>
          ) : (
            <button className="btn btn-primary" onClick={() => dispatch({ type: "ctl.next" })}>
              다음 단계 ▶
            </button>
          )}
        </div>
      </div>
      {idx === 0 && <p className="mt-1 text-[13px] text-[#c9ced4]">{sc.summary}</p>}
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 md:grid-cols-4">
        {FLOW.map((f) => (
          <div key={f.key} className="rounded-lg border px-2 py-1.5" style={{ borderColor: "#2c333b", background: "#12161a" }}>
            <div className="text-[11px] font-bold" style={{ color: f.color }}>
              {f.label}
            </div>
            <div className="text-[12.5px] leading-snug text-[#e1e4e8]">{fillCaption(st.caption[f.key], s)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
