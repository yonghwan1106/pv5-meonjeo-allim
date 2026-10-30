import type { Layer } from "@/lib/engine/types";

export function PreparingBadge({ text = "SDK 공개 시 연동" }: { text?: string }) {
  return (
    <span className="badge" style={{ color: "#c8b6ff" }} title="Pleos 문서상 「준비 중(Coming Soon)」 SDK — 지금은 웹 모의">
      {text}
    </span>
  );
}

export function AssumeBadge({ text }: { text: string }) {
  return (
    <span className="badge" style={{ color: "var(--warn)" }} title="문서·실차로 확인되지 않은 가정">
      [가정] {text}
    </span>
  );
}

export const LAYER_STYLE: Record<Layer, { label: string; color: string }> = {
  AAOS: { label: "AAOS", color: "#9fd3ff" },
  VEHICLE: { label: "Vehicle SDK", color: "#7cc4d6" },
  NAVI: { label: "NaviHelper", color: "#8fe0a8" },
  GLEO: { label: "Gleo", color: "#c8b6ff" },
  APP: { label: "앱 판단", color: "#f2d38a" },
  SERVER: { label: "서버(모의)", color: "#f2b75b" },
  CUSTOMER: { label: "고객", color: "#ff9fb2" },
  SIM: { label: "시뮬레이터", color: "#a9b1bb" },
};

export function LayerBadge({ layer }: { layer: Layer }) {
  const st = LAYER_STYLE[layer];
  return (
    <span className="badge shrink-0" style={{ color: st.color, minWidth: "5.6rem", justifyContent: "center" }}>
      {st.label}
    </span>
  );
}

export function Loading({ label = "시연 엔진 연결 중…" }: { label?: string }) {
  return <div className="p-6 text-muted">{label}</div>;
}
