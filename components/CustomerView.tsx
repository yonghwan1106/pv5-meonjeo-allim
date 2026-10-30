"use client";
/**
 * 고객 화면 (로그인 없는 1회용 링크 /c/[token]) — 지도·실시간 위치는 절대 보여 주지 않고 도착 예정 「범위」만.
 * 공동현관 번호는 받지 않는다 (보안 민감).
 */
import { useState } from "react";
import type { EngineAction, EngineState } from "@/lib/engine/types";
import { STAGES, toCustomerView } from "@/lib/logic/customerView";
import { canEnterUnderground, heightLabel } from "@/lib/logic/preArrival";
import day from "@/data/day.json";

type Entrance = { id: string; label: string; underground: boolean; clearanceMm: number | null };
const PARKING = day.parking as Record<string, { clearanceNote: string; entrances: Entrance[] }>;

export default function CustomerView({ s, dispatch, jobId }: { s: EngineState; dispatch: (a: EngineAction) => void; jobId: string }) {
  const job = s.server.jobs.find((j) => j.id === jobId);
  if (!job) return <div className="p-6 text-sm">링크가 만료되었거나 잘못된 주소예요.</div>;
  const v = toCustomerView(job, s.server.sessions[jobId], s.server.notices, s.clockSec / 60);
  const reply = (r: Parameters<typeof dispatchReply>[2]) => dispatchReply(dispatch, jobId, r);
  const showParking = v.pending?.kind === "PRE_ARRIVAL" || (v.home === "YES" && !v.parking.sent && (job.status === "EN_ROUTE" || job.status === "DELAY_NOTIFIED"));

  return (
    <div className="flex h-full flex-col bg-[#f5f6f8] text-[#15181c]" data-testid="customer-view">
      <div className="bg-[#1d2a30] px-4 pb-3 pt-4 text-white">
        <div className="text-[11px] opacity-80">먼저 알림 · {day.driver.company}</div>
        <div className="text-lg font-extrabold">{v.alias} 고객님</div>
        <div className="text-xs opacity-90">
          {v.work} · {v.place}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 scroll-thin">
        {/* 진행 단계 */}
        {v.stageIndex >= 0 ? (
          <ol className="flex items-center justify-between gap-1" aria-label="진행 단계">
            {STAGES.map((st, i) => (
              <li key={st} className="flex flex-1 flex-col items-center gap-1">
                <span className="h-2 w-full rounded-full" style={{ background: i <= v.stageIndex ? "#2c6474" : "#d5dadf" }} />
                <span className="text-[11px]" style={{ fontWeight: i === v.stageIndex ? 800 : 500, color: i === v.stageIndex ? "#15181c" : "#6b7480" }}>
                  {st}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-xl bg-[#fff4e0] p-3 text-sm font-bold">오늘 방문은 다른 날로 바뀌었어요.</div>
        )}

        {/* 질문 카드 */}
        {v.pending?.kind === "DELAY" && (
          <Question title="조금 늦어요. 어떻게 할까요?">
            <Btn onClick={() => reply("WAIT")} testId="reply-WAIT">기다릴게요</Btn>
            <Btn onClick={() => reply("POSTPONE_60")} testId="reply-POSTPONE_60">1시간 뒤로 미뤄 주세요</Btn>
            <Btn onClick={() => reply("OTHER_DAY")} light>
              다른 날로
            </Btn>
          </Question>
        )}
        {v.pending?.kind === "EARLIER_OFFER" && (
          <Question title="더 일찍 가도 괜찮으세요?">
            <Btn onClick={() => reply("OK_EARLIER")} testId="reply-OK_EARLIER">좋아요</Btn>
            <Btn onClick={() => reply("KEEP_ORIGINAL")} light>
              원래 시간대로
            </Btn>
          </Question>
        )}
        {v.pending?.kind === "PRE_ARRIVAL" && (
          <Question title="곧 도착해요. 지금 집에 계세요?">
            <Btn onClick={() => reply("HOME_YES")} testId="reply-HOME_YES">있어요</Btn>
            <Btn onClick={() => reply("HOME_LATER_30")}>30분 뒤 와 주세요</Btn>
            <Btn onClick={() => reply("HOME_NO")} light>
              오늘은 안 돼요
            </Btn>
          </Question>
        )}
        {showParking && <ParkingCard jobId={jobId} dispatch={dispatch} />}
        {v.parking.sent && (
          <div className="rounded-xl bg-[#e7f4ec] p-3 text-xs">
            주차 안내 보냄 — 방문 차량 등록 {v.parking.registered ? "완료 ✓" : "안 함"}
            {v.parking.entranceId ? ` · ${PARKING[jobId]?.entrances.find((e) => e.id === v.parking.entranceId)?.label ?? ""}` : ""}
          </div>
        )}

        {/* 도착 예정 */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {v.etaText ? (
            <>
              <div className="text-xs text-[#5b6470]">도착 예정 (분 단위 범위)</div>
              <div className="text-3xl font-extrabold tracking-tight" data-testid="eta-window">
                {v.etaText}
              </div>
              <div className="mt-1 text-xs text-[#5b6470]">약속 {v.promisedText}</div>
            </>
          ) : v.stage === "작업 중" ? (
            <>
              <div className="text-xs text-[#5b6470]">작업 중</div>
              <div className="text-2xl font-extrabold">{v.workStartedText} 시작</div>
            </>
          ) : v.stage === "도착" ? (
            <div className="text-2xl font-extrabold">기사님이 도착했어요</div>
          ) : v.stage === "완료" ? (
            <div className="text-2xl font-extrabold">작업을 마쳤어요</div>
          ) : (
            <>
              <div className="text-xs text-[#5b6470]">방문 약속</div>
              <div className="text-3xl font-extrabold">{v.promisedText}</div>
            </>
          )}
          <div className="mt-2 text-[11px] text-[#5b6470]">
            {day.driver.vehicle.split(" (")[0]} · 차번 뒤 {day.driver.plateTail}
          </div>
        </div>

        {/* 받은 알림 (알림톡 모의) */}
        <div>
          <div className="mb-1 text-xs font-bold text-[#5b6470]">받은 알림 (알림톡 모의)</div>
          <div className="space-y-1.5">
            {v.messages.length === 0 && <div className="text-xs text-[#6b7480]">아직 받은 알림이 없어요.</div>}
            {[...v.messages].reverse().map((m) => (
              <div key={m.id} className="rounded-xl rounded-tl-sm bg-white p-2.5 text-[13px] leading-snug shadow-sm">
                <div>{m.body}</div>
                <div className="mt-0.5 text-right text-[10px] text-[#7a838e]">{m.at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#dde1e5] bg-white px-3 py-2 text-[11px] leading-snug text-[#4a525c]">
        기사님 <b>위치는 보여 드리지 않고</b> 도착 예정 시각만 알려 드려요. 연락처는 업체가 맡긴 범위에서 발송에만 쓰고, 이 링크는 방문이 끝나면 만료돼요. 공동현관 번호는 받지 않아요.
      </div>
    </div>
  );
}

type Reply = "WAIT" | "POSTPONE_60" | "OTHER_DAY" | "OK_EARLIER" | "KEEP_ORIGINAL" | "HOME_YES" | "HOME_LATER_30" | "HOME_NO";
function dispatchReply(dispatch: (a: EngineAction) => void, jobId: string, reply: Reply) {
  dispatch({ type: "customer.reply", jobId, reply });
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-[#2c6474] bg-white p-3">
      <div className="mb-2 text-[15px] font-extrabold">{title}</div>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

function Btn({ children, onClick, light, testId }: { children: React.ReactNode; onClick: () => void; light?: boolean; testId?: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="rounded-xl px-3 py-2.5 text-[15px] font-bold"
      style={{ background: light ? "#eef1f4" : "#2c6474", color: light ? "#2a3138" : "#fff" }}
    >
      {children}
    </button>
  );
}

function ParkingCard({ jobId, dispatch }: { jobId: string; dispatch: (a: EngineAction) => void }) {
  const info = PARKING[jobId];
  const [registered, setRegistered] = useState(false);
  const [entrance, setEntrance] = useState<string | null>(null);
  const h = day.driver.heightMm;
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm" data-testid="parking-card">
      <div className="text-[15px] font-extrabold">주차 안내</div>
      <div className="mt-1 text-[13px]">
        이 차(PV5 카고)는 높이 <b>{heightLabel(h)}</b>예요 (전고 {h.toLocaleString()}mm).{" "}
        {canEnterUnderground(h, 2100) ? "높이 2.1m 지하주차장에 들어갈 수 있어요." : ""}
      </div>
      <label className="mt-2 flex items-center gap-2 text-[14px] font-bold">
        <input type="checkbox" checked={registered} onChange={(e) => setRegistered(e.target.checked)} className="h-5 w-5" />
        방문 차량 등록 완료
      </label>
      {info ? (
        <>
          <div className="mt-2 text-xs text-[#5b6470]">어디로 오면 될까요? ({info.clearanceNote})</div>
          <ComplexLayout entrances={info.entrances} selected={entrance} onSelect={setEntrance} />
          <div className="mt-1 grid gap-1">
            {info.entrances.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-[14px]">
                <input type="radio" name={`ent-${jobId}`} checked={entrance === e.id} onChange={() => setEntrance(e.id)} className="h-4 w-4" />
                {e.label}
                {e.underground && <span className="text-[11px] text-[#2c6474]">(지하 · 높이 제한 {((e.clearanceMm ?? 0) / 1000).toFixed(1)}m)</span>}
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-2 text-xs text-[#5b6470]">이 단지는 주차장 입구 정보가 없어요 — 등록 여부만 알려 주세요.</div>
      )}
      <button
        className="mt-3 w-full rounded-xl bg-[#2c6474] px-3 py-2.5 text-[15px] font-bold text-white"
        onClick={() => dispatch({ type: "customer.parking", jobId, registered, entranceId: entrance })}
        data-testid="parking-send"
      >
        기사님께 보내기
      </button>
    </div>
  );
}

/** 단지 배치도 (가상, 지도 아님) — 입구 2곳을 눌러 고른다 */
function ComplexLayout({ entrances, selected, onSelect }: { entrances: Entrance[]; selected: string | null; onSelect: (id: string) => void }) {
  const pos: Record<string, { x: number; y: number }> = { J4_PA: { x: 26, y: 52 }, J4_PB: { x: 74, y: 22 } };
  return (
    <svg viewBox="0 0 100 64" className="mt-1 w-full rounded-lg bg-[#eef1f4]" role="img" aria-label="가상 단지 배치도">
      <rect x="8" y="10" width="34" height="22" rx="2" fill="#cfd6dd" />
      <text x="25" y="23" fontSize="5" textAnchor="middle" fill="#3c454f">A동</text>
      <rect x="54" y="32" width="34" height="22" rx="2" fill="#cfd6dd" />
      <text x="71" y="45" fontSize="5" textAnchor="middle" fill="#3c454f">B동</text>
      <path d="M0 60 H100" stroke="#b7c0c9" strokeWidth="4" />
      <text x="50" y="62.5" fontSize="3.2" textAnchor="middle" fill="#55606b">단지 정문 (가상)</text>
      {entrances.map((e) => {
        const p = pos[e.id] ?? { x: 50, y: 30 };
        const on = selected === e.id;
        return (
          <g key={e.id} onClick={() => onSelect(e.id)} style={{ cursor: "pointer" }}>
            <circle cx={p.x} cy={p.y} r={on ? 4.6 : 3.8} fill={on ? "#2c6474" : "#fff"} stroke="#2c6474" strokeWidth="1.2" />
            <text x={p.x} y={p.y + 1.5} fontSize="4" textAnchor="middle" fill={on ? "#fff" : "#2c6474"} fontWeight="bold">
              {e.underground ? "B" : "P"}
            </text>
            <text x={p.x} y={p.y - 6} fontSize="3.4" textAnchor="middle" fill="#2a3138">
              {e.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
