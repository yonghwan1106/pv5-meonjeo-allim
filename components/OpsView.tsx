"use client";
/** 업체 관제 — 기사 타임라인·보낸 알림 문구 기록·고객 응답·오늘 통계 (위치 지도 없음) */
import type { EngineState } from "@/lib/engine/types";
import { JOB_STATUS_LABEL } from "@/lib/logic/jobState";
import { fmtHHMM } from "@/lib/logic/time";
import day from "@/data/day.json";

const KIND_COLOR: Record<string, string> = {
  DELAY_NOTICE: "#c0392b",
  REPLY: "#2c6474",
  REPLAN: "#b9770e",
  ARRIVE: "#1e8449",
  WORK_START: "#1e8449",
  DONE: "#566573",
  DEPART: "#2874a6",
  PRE_ARRIVAL: "#7d3c98",
  PARKING: "#7d3c98",
  DECLINED: "#7f8c8d",
  DAY_END: "#566573",
};

export default function OpsView({ s, compact = false }: { s: EngineState; compact?: boolean }) {
  const sv = s.server;
  const ordered = [...sv.jobs].sort((a, b) => a.seq - b.seq);
  const pos = (id: string) => sv.order.indexOf(id);
  const st = sv.stats;
  const late = sv.jobs.filter((j) => j.status !== "OTHER_DAY" && (j.promisedMin > j.originalPromisedMin || j.status === "DELAY_NOTIFIED")).length;
  return (
    <div className={`flex h-full flex-col bg-[#f5f6f8] text-[#15181c] ${compact ? "text-[12px]" : "text-sm"}`} data-testid="ops-view">
      <div className="bg-[#22303a] px-3 py-2 text-white">
        <div className="text-[11px] opacity-80">업체 관제 · {day.driver.company}</div>
        <div className="font-extrabold">
          {day.driver.alias} · {day.driver.vehicle.split(" (")[0]} · {fmtHHMM(s.clockSec / 60)}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 p-2">
        {[
          { k: "지연 알림", v: st.delayNotices },
          { k: "고객 응답", v: st.replies },
          { k: "밀린 고객", v: late },
          { k: "헛걸음 막음", v: st.wastedTripsAvoided },
        ].map((x) => (
          <div key={x.k} className="rounded-lg bg-white p-1.5 text-center shadow-sm">
            <div className="text-[10px] text-[#5b6470]">{x.k}</div>
            <div className="text-lg font-extrabold">{x.v}</div>
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2 scroll-thin">
        <section className="rounded-lg bg-white p-2 shadow-sm">
          <div className="mb-1 text-xs font-bold text-[#5b6470]">오늘 순서 (서버 계획 · 내비엔 다음 1곳만)</div>
          <table className="w-full text-left">
            <tbody>
              {ordered.map((j) => {
                const p = pos(j.id);
                return (
                  <tr key={j.id} className="border-t border-[#eef0f2]">
                    <td className="w-6 py-0.5 font-bold text-[#2c6474]">{p >= 0 ? p + 1 : "–"}</td>
                    <td className="py-0.5">
                      {j.customerAlias} <span className="text-[10px] text-[#7a838e]">{j.phoneMasked}</span>
                    </td>
                    <td className="py-0.5 tabular-nums">
                      {j.promisedMin !== j.originalPromisedMin ? (
                        <>
                          <s className="text-[#9aa3ad]">{fmtHHMM(j.originalPromisedMin)}</s> {fmtHHMM(j.promisedMin)}
                        </>
                      ) : (
                        fmtHHMM(j.promisedMin)
                      )}
                    </td>
                    <td className="py-0.5 text-right text-[11px]">{JOB_STATUS_LABEL[j.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="rounded-lg bg-white p-2 shadow-sm">
          <div className="mb-1 text-xs font-bold text-[#5b6470]">기사 타임라인 (차량 신호로 자동 기록)</div>
          <ul className="space-y-0.5">
            {[...sv.timeline].reverse().slice(0, compact ? 14 : 40).map((t) => (
              <li key={t.id} className="flex gap-2">
                <span className="w-10 shrink-0 tabular-nums text-[#7a838e]">{fmtHHMM(t.tSec / 60)}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[t.kind] ?? "#999" }} />
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg bg-white p-2 shadow-sm">
          <div className="mb-1 text-xs font-bold text-[#5b6470]">보낸 알림 문구 기록 (알림톡 모의 · 승인 방식)</div>
          <ul className="space-y-1">
            {[...sv.notices].reverse().slice(0, compact ? 6 : 30).map((n) => {
              const j = sv.jobs.find((x) => x.id === n.jobId)!;
              return (
                <li key={n.id} className="border-t border-[#eef0f2] pt-1">
                  <div className="flex gap-2 text-[11px] text-[#5b6470]">
                    <span className="tabular-nums">{fmtHHMM(n.sentAtSec / 60)}</span>
                    <span className="font-bold">{n.template}</span>
                    <span>→ {j.customerAlias}</span>
                    <span className="ml-auto">{n.approvedBy === "VOICE" ? "음성 승인" : n.approvedBy === "TOUCH" ? "정차 중 터치" : "자동"}</span>
                  </div>
                  <div className="leading-snug">{n.body}</div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
