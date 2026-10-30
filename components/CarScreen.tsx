"use client";
/**
 * PV5 차량 화면 (12.9인치 16:9 비율) — 왼쪽 = 내비 자리(자체 노선도 모의), 오른쪽 = 「먼저 알림」 앱 창.
 * Pleos 화면 모델: Driving view + 앱 영역 window. Gleo는 OS 상위 레이어라 앱 위에 겹쳐 뜬다.
 * 주행 상태 3단: 주행 = 큰 글자 2줄 + 칩 1개 / 정지 = + 받은 답장 1줄 / 주차(P) = 전체 조작.
 */
import type { EngineAction, EngineState } from "@/lib/engine/types";
import { CAR_CODE_LABEL, carScreenCode, currentJob, statusLine } from "@/lib/engine/carScreen";
import { DRIVE_MODE_LABEL } from "@/lib/logic/driveMode";
import { JOB_STATUS_LABEL } from "@/lib/logic/jobState";
import { fmtHHMM } from "@/lib/logic/time";
import { predictDelayMin, delayForMessage } from "@/lib/logic/delay";
import RouteMap from "./RouteMap";

const TONE: Record<string, string> = { ok: "var(--ok)", warn: "var(--warn)", info: "var(--info)", danger: "var(--danger)" };

export default function CarScreen({ s, dispatch }: { s: EngineState; dispatch: (a: EngineAction) => void }) {
  const app = s.app;
  const code = carScreenCode(s);
  const touchable = app.mode === "PARKED";
  const nowMin = s.clockSec / 60;

  const blockIfDriving = (e: React.SyntheticEvent) => {
    if (!touchable) {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "car.touch" });
    }
  };

  return (
    <div className="car-frame" data-testid="car-screen">
      <StatusBar s={s} code={code} />
      <div className="absolute inset-x-0 bottom-0 top-[7.5%] flex">
        {/* 내비 자리 */}
        <section className="relative w-[50%] border-r border-[#20262c]" aria-label="내비게이션 (모의)">
          <NaviPane s={s} />
        </section>
        {/* 먼저 알림 앱 창 */}
        <section
          className="relative w-[50%] bg-[#0f1317]"
          aria-label="먼저 알림 앱 창"
          onClickCapture={blockIfDriving}
          data-testid="car-app-window"
        >
          {code === "C8" ? (
            <DayEnd s={s} />
          ) : app.mode !== "PARKED" ? (
            <DrivingPane s={s} />
          ) : currentJob(s) && (currentJob(s)!.status === "ARRIVED" || currentJob(s)!.status === "IN_PROGRESS") ? (
            <OnSitePane s={s} dispatch={dispatch} nowMin={nowMin} />
          ) : (
            <ParkedPane s={s} dispatch={dispatch} />
          )}
        </section>
      </div>
      <Subtitle s={s} />
      {app.gleo && <GleoCard s={s} />}
      {!app.gleo && app.gleoResult && <GleoResult s={s} />}
      {s.overlay && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 text-center" role="alert">
          <div className="cq-2xl font-extrabold" style={{ color: "var(--warn)" }}>
            {s.overlay.text}
          </div>
          <div className="cq-md mt-[1.2cqw] text-[#d6dade]">도로교통법 제49조 제1항 제11의2호 — 운전 중 영상표시장치 조작 금지</div>
          <div className="cq-sm mt-[0.6cqw] text-muted">「다음 어디야?」처럼 Gleo 음성으로 물어보세요</div>
        </div>
      )}
    </div>
  );
}

function StatusBar({ s, code }: { s: EngineState; code: keyof typeof CAR_CODE_LABEL }) {
  const app = s.app;
  const gears = ["P", "R", "N", "D"] as const;
  return (
    <div className="absolute inset-x-0 top-0 flex h-[7.5%] items-center gap-[1.4cqw] border-b border-[#20262c] bg-[#0a0d10] px-[1.6cqw]">
      <span className="cq-md font-bold tabular-nums">{fmtHHMM(s.clockSec / 60)}</span>
      <span className="cq-xs rounded-full border px-[0.8cqw] py-[0.15cqw]" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
        {code} · {CAR_CODE_LABEL[code]}
      </span>
      <span className="cq-sm font-bold text-[#d6dade]">먼저 알림</span>
      <span className="ml-auto flex items-center gap-[0.5cqw]" aria-label={`기어 ${app.gear}`}>
        {gears.map((g) => (
          <span key={g} className="cq-md font-extrabold" style={{ color: app.gear === g ? "#fff" : "#4b545e" }}>
            {g}
          </span>
        ))}
      </span>
      <span className="cq-md tabular-nums font-bold">{app.speedKmh} km/h</span>
      <span className="cq-sm tabular-nums text-[#c9ced4]">SOC {Math.floor(app.soc)}%</span>
      <span className="cq-xs rounded px-[0.6cqw] py-[0.15cqw] font-bold" style={{ background: app.mode === "PARKED" ? "#1d3b2c" : "#4a3418", color: app.mode === "PARKED" ? "var(--ok)" : "var(--warn)" }}>
        {app.mode === "PARKED" ? "터치 가능" : "터치 막음 · 음성만"}
      </span>
    </div>
  );
}

function NaviPane({ s }: { s: EngineState }) {
  const app = s.app;
  const trip = app.trip;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline gap-[1cqw] px-[1.4cqw] pt-[1cqw]">
        <span className="cq-xs text-muted">내비 (모의)</span>
        <span className="cq-sm truncate font-bold">{app.route ? app.route.poiName : "목적지 없음"}</span>
      </div>
      <div className="relative min-h-0 flex-1 px-[0.6cqw]">
        <RouteMap s={s} />
      </div>
      <div className="grid grid-cols-3 gap-[0.6cqw] border-t border-[#20262c] px-[1.4cqw] py-[0.9cqw]">
        <Stat label="도착 예정" value={trip ? fmtHHMM(trip.etaMin) : "—"} />
        <Stat label="남은 거리" value={trip ? `${(trip.remainDistM / 1000).toFixed(1)}km` : "—"} />
        <Stat label="도착 시 배터리" value={trip ? `${trip.estimatedSocAtDest}%` : "—"} />
      </div>
      <div className="cq-xs px-[1.4cqw] pb-[0.7cqw] text-[#7d8792]">NaviHelper TripInfo·DestinationInfo 값 · 지도 API 없이 자체 노선도</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="cq-xs text-muted">{label}</div>
      <div className="cq-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function DrivingPane({ s }: { s: EngineState }) {
  const app = s.app;
  const job = s.server.jobs.find((j) => j.id === app.route?.jobId);
  const line = statusLine(s);
  if (!job || !app.trip) {
    return (
      <div className="flex h-full flex-col justify-center p-[3cqw]">
        <div className="cq-xl font-bold">목적지 없이 주행 중</div>
        <div className="cq-md mt-[1cqw] text-muted">「다음 어디야?」라고 말해 보세요</div>
      </div>
    );
  }
  const delay = predictDelayMin(app.trip.etaMin, job.promisedMin);
  const dColor = delay >= 10 ? "var(--danger)" : delay > 0 ? "var(--warn)" : "var(--ok)";
  return (
    <div className="flex h-full flex-col p-[2.2cqw]">
      <div className="cq-sm text-muted">다음 방문</div>
      <div className="cq-2xl mt-[0.3cqw] font-extrabold">{job.customerAlias} 고객</div>
      <div className="cq-xl mt-[0.6cqw] font-bold tabular-nums">
        도착 {fmtHHMM(app.trip.etaMin)} · 약속 {fmtHHMM(job.promisedMin)}{" "}
        <span style={{ color: dColor }}>({delay > 0 ? `+${delay}분` : delay === 0 ? "정시" : `−${-delay}분`})</span>
      </div>
      {line && (
        <div className="cq-md mt-[1.4cqw] inline-flex max-w-full self-start rounded-full border px-[1.2cqw] py-[0.4cqw] font-bold" style={{ color: TONE[line.tone], borderColor: TONE[line.tone] }}>
          <span className="truncate">{line.text}</span>
        </div>
      )}
      {app.mode === "STOPPED" && app.replyLine && <div className="cq-lg mt-[1.2cqw] font-bold text-[#e5e8eb]">{app.replyLine}</div>}
      <div className="cq-xs mt-auto text-[#7d8792]">
        {app.mode === "STOPPED" ? "정지 중 — 받은 답장 1줄만 더 보여요. 터치는 기어 P에서" : "주행 중 — 큰 글자 2줄만. 화면을 누르면 막혀요"}
      </div>
    </div>
  );
}

function OnSitePane({ s, dispatch, nowMin }: { s: EngineState; dispatch: (a: EngineAction) => void; nowMin: number }) {
  const job = currentJob(s)!;
  const app = s.app;
  const working = job.status === "IN_PROGRESS" && job.workStartedAt !== null;
  const elapsed = working ? Math.max(0, Math.floor(nowMin - job.workStartedAt!)) : 0;
  const pct = working ? Math.min(100, (elapsed / job.estWorkMin) * 100) : 0;
  const over = working && elapsed > job.estWorkMin;
  const upcoming = s.server.order.slice(0, 3).map((id) => s.server.jobs.find((j) => j.id === id)!);
  const o = app.overrun;
  const oj = o ? s.server.jobs.find((j) => j.id === o.nextJobId) : null;
  return (
    <div className="flex h-full flex-col gap-[0.9cqw] p-[1.8cqw]">
      <div className="flex items-baseline gap-[1cqw]">
        <span className="cq-xl font-extrabold">{job.customerAlias} 고객</span>
        <span className="cq-sm truncate text-muted">{job.place}</span>
      </div>
      <div className="cq-sm text-[#c9ced4]">
        작업: {job.work} · 도착 {job.arrivedAt !== null ? fmtHHMM(job.arrivedAt) : "—"}
        {working ? ` · 시작 ${fmtHHMM(job.workStartedAt!)}` : ""}
      </div>
      {working ? (
        <div>
          <div className="cq-md flex justify-between font-bold tabular-nums">
            <span>작업 {elapsed}분째</span>
            <span style={{ color: over ? "var(--danger)" : "var(--muted)" }}>예정 {job.estWorkMin}분</span>
          </div>
          <div className="mt-[0.4cqw] h-[0.8cqw] rounded-full bg-[#232a31]">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "var(--danger)" : "var(--accent)" }} />
          </div>
          <div className="cq-xs mt-[0.4cqw] text-[#9aa3ad]">
            카고 뒷문 {app.rearOpen ? "열림" : "닫힘"} — 작업 시작 신호 <span style={{ color: "var(--warn)" }}>[가정] PV5 카고 뒷문 = DoorValue.REAR</span>
          </div>
        </div>
      ) : (
        <div className="cq-md rounded-lg border border-[#2a4a52] bg-[#122027] p-[1cqw]">
          도착 알림을 보냈어요. <b>카고 뒷문을 열면</b> 작업 시작이 자동 기록돼요.
        </div>
      )}
      {o && oj && (
        <div className="rounded-lg border p-[1cqw]" style={{ borderColor: "var(--danger)", background: "#2a1517" }}>
          <div className="cq-md font-bold">
            다음 {oj.customerAlias} 고객님 도착이 {fmtHHMM(o.etaMin)}쯤, 약 {delayForMessage(o.delayMin)}분 늦어져요 — 미리 알릴까요?
          </div>
          <div className="mt-[0.8cqw] flex gap-[1cqw]">
            <button className="btn btn-primary cq-md" style={{ padding: "0.6cqw 1.6cqw" }} onClick={() => dispatch({ type: "car.tap", button: "NOTIFY_OVERRUN" })}>
              미리 알리기
            </button>
            <button className="btn cq-md" style={{ padding: "0.6cqw 1.6cqw" }} onClick={() => dispatch({ type: "car.tap", button: "DISMISS_OVERRUN" })}>
              괜찮아요
            </button>
          </div>
        </div>
      )}
      <div className="mt-auto">
        <div className="cq-xs mb-[0.3cqw] text-muted">다음 일정</div>
        {upcoming.map((j) => (
          <div key={j.id} className="cq-sm flex justify-between border-t border-[#1f252b] py-[0.3cqw]">
            <span>
              {j.customerAlias} · {j.place.replace(" [가상]", "")}
            </span>
            <span className="tabular-nums text-[#c9ced4]">
              {fmtHHMM(j.promisedMin)} · {JOB_STATUS_LABEL[j.status]}
            </span>
          </div>
        ))}
        {app.replyLine && <div className="cq-xs mt-[0.4cqw] text-[#9aa3ad]">최근 답장 — {app.replyLine}</div>}
      </div>
    </div>
  );
}

function ParkedPane({ s, dispatch }: { s: EngineState; dispatch: (a: EngineAction) => void }) {
  const app = s.app;
  const jobs = [...s.server.jobs].sort((a, b) => a.seq - b.seq);
  const canStart = !app.route && s.server.order.length > 0;
  const routeJob = s.server.jobs.find((j) => j.id === app.route?.jobId);
  return (
    <div className="flex h-full flex-col p-[1.8cqw]">
      <div className="flex items-baseline justify-between">
        <span className="cq-lg font-extrabold">오늘 방문 {jobs.length}건</span>
        <span className="cq-xs text-muted">{DRIVE_MODE_LABEL[app.mode]} — 전체 조작 가능</span>
      </div>
      <div className="mt-[0.8cqw] min-h-0 flex-1 overflow-hidden">
        {jobs.map((j) => {
          const next = s.server.order[0] === j.id;
          return (
            <div key={j.id} className="cq-sm flex items-center gap-[1cqw] border-t border-[#1f252b] py-[0.45cqw]" style={{ opacity: j.status === "DONE" || j.status === "OTHER_DAY" ? 0.5 : 1 }}>
              <span className="w-[5cqw] tabular-nums font-bold">{fmtHHMM(j.promisedMin)}</span>
              <span className="flex-1 truncate">
                {j.customerAlias} · {j.work}
              </span>
              <span className="cq-xs" style={{ color: next ? "var(--accent)" : "var(--muted)" }}>
                {next ? "다음" : JOB_STATUS_LABEL[j.status]}
              </span>
            </div>
          );
        })}
      </div>
      {canStart ? (
        <button className="btn btn-primary cq-lg mt-[1cqw] w-full" style={{ padding: "1cqw" }} onClick={() => dispatch({ type: "car.tap", button: "START_FIRST" })} data-testid="start-first">
          첫 고객으로 출발 (내비 목적지 설정)
        </button>
      ) : routeJob ? (
        <div className="cq-md mt-[1cqw] rounded-lg border border-[#2a4a52] bg-[#122027] p-[1cqw]">
          목적지: {routeJob.customerAlias} 고객 — 기어 D로 출발하면 「출발했어요」가 자동으로 가요
        </div>
      ) : null}
    </div>
  );
}

function DayEnd({ s }: { s: EngineState }) {
  const st = s.server.stats;
  const done = s.server.jobs.filter((j) => j.status === "DONE").length;
  const items = [
    { k: "완료 방문", v: `${done}건` },
    { k: "지연 알림 (손 안 대고)", v: `${st.delayNotices}건` },
    { k: "고객 응답", v: `${st.replies}건` },
    { k: "순서 다시 짬", v: `${st.replans}번` },
    { k: "헛걸음 막음", v: `${st.wastedTripsAvoided}번` },
    { k: "가장 큰 지연", v: `${st.maxDelayMin}분` },
  ];
  return (
    <div className="flex h-full flex-col p-[2cqw]">
      <div className="cq-xl font-extrabold">오늘 하루 끝 — 수고하셨어요</div>
      <div className="mt-[1.4cqw] grid grid-cols-2 gap-[1cqw]">
        {items.map((i) => (
          <div key={i.k} className="rounded-lg border border-[#242b32] bg-[#141a1f] p-[1cqw]">
            <div className="cq-xs text-muted">{i.k}</div>
            <div className="cq-xl font-bold tabular-nums">{i.v}</div>
          </div>
        ))}
      </div>
      <div className="cq-xs mt-auto text-[#7d8792]">운전 중 휴대폰을 집은 횟수 0 — 모든 알림은 차량 신호·음성 승인으로 나감</div>
    </div>
  );
}

function Subtitle({ s }: { s: EngineState }) {
  const last = s.speech[s.speech.length - 1];
  if (!last) return null;
  const fresh = s.realMs - last.realMs < 8000;
  return (
    <div className="absolute left-[1.4%] top-[15%] z-10 max-w-[46%] rounded-xl border px-[1.2cqw] py-[0.7cqw]" style={{ background: "rgba(10,13,16,0.92)", borderColor: fresh ? "#c8b6ff" : "#2c333b", opacity: fresh ? 1 : 0.75 }} aria-live="polite">
      <div className="cq-xs flex items-center gap-[0.6cqw] text-[#c8b6ff]">
        <span>{last.source === "GLEO" ? "Gleo 음성" : "앱 안내 음성"} (자막)</span>
        <span className="rounded-full border px-[0.5cqw]" style={{ borderColor: "#c8b6ff" }}>
          SDK 공개 시 TTS 연동 (현재 모의)
        </span>
      </div>
      <div className="cq-md mt-[0.2cqw] font-bold">“{last.text}”</div>
    </div>
  );
}

function GleoCard({ s }: { s: EngineState }) {
  const g = s.app.gleo!;
  const secs = Math.max(0, Math.ceil(g.remainingMs / 1000));
  return (
    <div className="absolute bottom-[3%] right-[1.4%] z-20 w-[50%] rounded-2xl border-2 p-[1.4cqw]" style={{ background: "rgba(22,18,34,0.97)", borderColor: "#c8b6ff" }} role="dialog" aria-label="Gleo 음성 질문" data-testid="gleo-card">
      <div className="cq-xs flex items-center gap-[0.8cqw] text-[#c8b6ff]">
        <span className="font-bold">Gleo · {g.functionName}</span>
        <span>asking</span>
        <span className="ml-auto rounded-full border px-[0.6cqw]" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          [가정] 앱이 먼저 묻기(proactive)
        </span>
      </div>
      <div className="cq-lg mt-[0.6cqw] font-bold">{g.promptKo}</div>
      <div className="mt-[0.9cqw] flex items-center gap-[1cqw]">
        <span className="cq-md font-extrabold">음성으로 답하세요:</span>
        <span className="cq-md rounded-full bg-[#2a2440] px-[1.2cqw] py-[0.2cqw] font-bold">「그래」</span>
        <span className="cq-md rounded-full bg-[#2a2440] px-[1.2cqw] py-[0.2cqw] font-bold">「아니」</span>
        <span className="cq-sm ml-auto tabular-nums text-[#d9cffd]" title="응답 대기 7초 (Gleo 7초 제한 준용) · 일시정지 중엔 멈춤">
          {secs}초 {g.retried ? "(다시 묻는 중)" : ""}
        </span>
      </div>
      <div className="mt-[0.5cqw] flex gap-[0.3cqw]">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="h-[0.5cqw] flex-1 rounded-full" style={{ background: i < secs ? "#c8b6ff" : "#3a3450" }} />
        ))}
      </div>
    </div>
  );
}

function GleoResult({ s }: { s: EngineState }) {
  const r = s.app.gleoResult!;
  const ok = r.status === "success";
  return (
    <div className="absolute right-[1.4%] top-[9.5%] z-20 max-w-[48%] rounded-xl border px-[1.2cqw] py-[0.7cqw]" style={{ background: "rgba(16,22,20,0.96)", borderColor: ok ? "var(--ok)" : "var(--warn)" }}>
      <div className="cq-xs" style={{ color: ok ? "var(--ok)" : "var(--warn)" }}>
        Gleo Callback · {r.functionName} · status={r.status}
      </div>
      <div className="cq-md font-bold">{r.subtitleKo}</div>
    </div>
  );
}
