"use client";
/** 동반 화면 — 휴대폰 틀 안에 「고객 휴대폰」/「업체 관제」 탭 */
import { useState } from "react";
import type { EngineAction, EngineState } from "@/lib/engine/types";
import CustomerView from "./CustomerView";
import OpsView from "./OpsView";

export default function Companion({ s, dispatch, height = 640 }: { s: EngineState; dispatch: (a: EngineAction) => void; height?: number | string }) {
  const [tab, setTab] = useState<"customer" | "ops">("customer");
  const [pinned, setPinned] = useState<string | null>(null);
  const jobId = pinned ?? s.focusJobId ?? s.server.order[0] ?? s.server.jobs[1].id;
  const jobs = [...s.server.jobs].sort((a, b) => a.seq - b.seq);
  const job = s.server.jobs.find((j) => j.id === jobId);
  return (
    <div className="flex flex-col gap-2" data-testid="companion">
      <div className="flex gap-1" role="tablist" aria-label="동반 화면">
        <button role="tab" aria-selected={tab === "customer"} className={`btn flex-1 ${tab === "customer" ? "on" : ""}`} onClick={() => setTab("customer")} data-testid="tab-customer">
          고객 휴대폰
        </button>
        <button role="tab" aria-selected={tab === "ops"} className={`btn flex-1 ${tab === "ops" ? "on" : ""}`} onClick={() => setTab("ops")} data-testid="tab-ops">
          업체 관제
        </button>
      </div>
      {tab === "customer" && (
        <div className="flex items-center gap-1 text-xs">
          <label htmlFor="who" className="text-muted">
            보는 고객
          </label>
          <select
            id="who"
            className="flex-1 rounded-md border border-line bg-panel2 px-2 py-1 text-ink"
            value={pinned ?? "AUTO"}
            onChange={(e) => setPinned(e.target.value === "AUTO" ? null : e.target.value)}
          >
            <option value="AUTO">자동 (방금 알림 받은 고객{job ? ` = ${job.customerAlias}` : ""})</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.customerAlias} · {j.place.replace(" [가상]", "")}
              </option>
            ))}
          </select>
          {job && (
            <a className="text-[11px]" href={`/c/${job.token}`} target="_blank" rel="noreferrer" title="같은 브라우저 새 탭에서 고객 링크 열기 (탭 간 동기화)">
              새 탭
            </a>
          )}
        </div>
      )}
      <div className="phone mx-auto w-full max-w-[360px]" style={{ height }}>
        {tab === "customer" ? <CustomerView s={s} dispatch={dispatch} jobId={jobId} /> : <OpsView s={s} compact />}
      </div>
    </div>
  );
}
