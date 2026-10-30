"use client";
/**
 * 시뮬레이터 — Pleos Connect Virtual Console 카드 이름·값 범위를 그대로 흉내 낸다
 * (Gear Selection P/R/N/D · Door Position · Door Lock · Seat Occupancy · Battery SOC 0~100%).
 * 기어·차속은 AAOS 표준(GEAR_SELECTION·PERF_VEHICLE_SPEED). 운전자 음성은 「그래/아니」 버튼(+선택적 브라우저 음성 인식).
 */
import { useState } from "react";
import type { EngineAction, EngineState, Speed } from "@/lib/engine/types";
import type { DoorValue } from "@/lib/pleos/vehicle";
import { SCENARIOS, getScenario } from "@/lib/engine/scenarios";
import { fmtHHMM } from "@/lib/logic/time";
import { matchVoiceIntent } from "@/lib/logic/voice";

const DOORS: { area: DoorValue; label: string; note?: string }[] = [
  { area: "ROW_1_LEFT", label: "ROW_1_LEFT 운전석" },
  { area: "ROW_1_RIGHT", label: "ROW_1_RIGHT 조수석" },
  { area: "ROW_2_RIGHT", label: "ROW_2_RIGHT 슬라이딩" },
  { area: "REAR", label: "REAR 카고 뒷문", note: "[가정] 매핑" },
];

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card p-3">
      <h3 className="mb-2 flex items-baseline gap-2 text-sm font-bold">
        {title}
        {sub && <span className="text-[11px] font-normal text-muted">{sub}</span>}
      </h3>
      {children}
    </section>
  );
}

export function ScenarioControls({ s, dispatch, onFirstPlay }: { s: EngineState; dispatch: (a: EngineAction) => void; onFirstPlay?: () => void }) {
  const sc = getScenario(s.scenario.id);
  const idx = s.scenario.stepIndex;
  return (
    <Card title="시나리오" sub="자동 재생 · 단계 이동 · 초기화">
      <div className="grid grid-cols-1 gap-1">
        {SCENARIOS.map((x) => (
          <button key={x.id} className="btn justify-start text-left" aria-pressed={x.id === s.scenario.id} onClick={() => dispatch({ type: "ctl.load", scenarioId: x.id })} data-testid={`load-${x.id}`}>
            {x.short}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {s.playing ? (
          <button className="btn btn-primary" onClick={() => dispatch({ type: "ctl.pause" })}>
            일시정지
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              onFirstPlay?.();
              dispatch({ type: "ctl.play" });
            }}
            data-testid="play"
          >
            ▶ 재생
          </button>
        )}
        <button className="btn" onClick={() => dispatch({ type: "ctl.prev" })} disabled={idx <= 0} aria-label="이전 단계">
          ◀ 이전
        </button>
        <button className="btn" onClick={() => dispatch({ type: "ctl.next" })} disabled={idx >= sc.steps.length - 1} aria-label="다음 단계" data-testid="next">
          다음 ▶
        </button>
        <button className="btn" onClick={() => dispatch({ type: "ctl.reset" })}>
          초기화
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <span className="text-xs text-muted">배속</span>
        {([1, 10, 60] as Speed[]).map((v) => (
          <button key={v} className="btn" aria-pressed={s.speed === v} onClick={() => dispatch({ type: "ctl.speed", speed: v })}>
            ×{v}
          </button>
        ))}
        <span className="ml-auto text-lg font-extrabold tabular-nums">{fmtHHMM(s.clockSec / 60)}</span>
      </div>
      <ol className="mt-2 space-y-0.5 text-xs">
        {sc.steps.map((st, i) => (
          <li key={i}>
            <button
              className="w-full truncate rounded px-1.5 py-0.5 text-left"
              style={{ background: i === idx ? "#26323a" : "transparent", color: i <= idx ? "var(--text)" : "var(--muted)", fontWeight: i === idx ? 700 : 400 }}
              onClick={() => dispatch({ type: "ctl.jump", index: i })}
            >
              {i}. {st.caption.title}
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function Simulator({ s, dispatch, onFirstPlay, showScenario = true }: { s: EngineState; dispatch: (a: EngineAction) => void; onFirstPlay?: () => void; showScenario?: boolean }) {
  const w = s.world;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);

  const listen = () => {
    type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; onerror: () => void; start: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setHeard("이 브라우저는 음성 인식을 지원하지 않아요 — 버튼을 쓰세요");
      return;
    }
    const r = new Ctor();
    r.lang = "ko-KR";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const intent = matchVoiceIntent(text);
      setHeard(`「${text}」 → ${intent ?? "알아듣지 못함"}`);
      if (intent === "YES") dispatch({ type: "voice.yes" });
      else if (intent === "NO") dispatch({ type: "voice.no" });
      else if (intent) dispatch({ type: "voice.command", intent });
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="simulator">
      {showScenario && <ScenarioControls s={s} dispatch={dispatch} onFirstPlay={onFirstPlay} />}

      <Card title="Motion" sub="AAOS GEAR_SELECTION · PERF_VEHICLE_SPEED">
        <div className="flex items-center gap-1">
          <span className="w-24 text-xs text-muted">Gear Selection</span>
          {(["P", "R", "N", "D"] as const).map((g) => (
            <button key={g} className="btn w-9" aria-pressed={w.gear === g} onClick={() => dispatch({ type: "sim.gear", gear: g })} data-testid={`gear-${g}`}>
              {g}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <span className="w-24 text-muted">Vehicle Speed</span>
          <input type="range" min={0} max={100} step={5} value={w.speedKmh} onChange={(e) => dispatch({ type: "sim.speed", kmh: Number(e.target.value) })} className="flex-1 accent-[#7cc4d6]" aria-label="차속 km/h" />
          <span className="w-16 text-right font-bold tabular-nums">{w.speedKmh} km/h</span>
        </label>
        <div className="mt-1 flex gap-1">
          {[0, 30, 50].map((v) => (
            <button key={v} className="btn" onClick={() => dispatch({ type: "sim.speed", kmh: v })}>
              {v === 0 ? "정지 0" : `${v}km/h`}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Convenience" sub="Door Position 0 Closed / 1 Open">
        <div className="grid grid-cols-1 gap-1">
          {DOORS.map((d) => (
            <div key={d.area} className="flex items-center gap-2 text-xs">
              <span className="flex-1">
                {d.label} {d.note && <span className="text-warn">{d.note}</span>}
              </span>
              <button className="btn" aria-pressed={w.doors[d.area] === 1} onClick={() => dispatch({ type: "sim.door", area: d.area, open: w.doors[d.area] !== 1 })} data-testid={`door-${d.area}`}>
                {w.doors[d.area] === 1 ? "Open" : "Closed"}
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex-1">Door Lock</span>
            <button className="btn" aria-pressed={w.locked} onClick={() => dispatch({ type: "sim.lock", locked: !w.locked })}>
              {w.locked ? "Locked" : "Unlocked"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex-1">Seat Occupancy ROW_1_LEFT</span>
            <button className="btn" aria-pressed={w.seatDriver === "OCCUPIED"} onClick={() => dispatch({ type: "sim.seat", occupied: w.seatDriver !== "OCCUPIED" })}>
              {w.seatDriver === "OCCUPIED" ? "Occupied" : "Empty"}
            </button>
          </div>
        </div>
      </Card>

      <Card title="Energy" sub="Battery SOC 0~100%">
        <label className="flex items-center gap-2 text-xs">
          <span className="w-24 text-muted">Battery SOC</span>
          <input type="range" min={0} max={100} value={Math.floor(w.soc)} onChange={(e) => dispatch({ type: "sim.soc", pct: Number(e.target.value) })} className="flex-1 accent-[#7cc4d6]" aria-label="배터리 SOC" />
          <span className="w-12 text-right font-bold tabular-nums">{Math.floor(w.soc)}%</span>
        </label>
      </Card>

      <Card title="내비 (NaviHelper 모의)" sub="자체 시간표 · 정체 계수">
        <div className="grid grid-cols-2 gap-1">
          <button className="btn" onClick={() => dispatch({ type: "navi.congestion", addMin: 10 })}>
            정체 +10분
          </button>
          <button className="btn" onClick={() => dispatch({ type: "navi.congestion", addMin: 20 })} data-testid="congestion-20">
            정체 +20분
          </button>
          <button className="btn" onClick={() => dispatch({ type: "navi.clearCongestion" })}>
            정체 해소
          </button>
          <button className="btn" onClick={() => dispatch({ type: "navi.remainKm", km: 3 })}>
            남은 3km
          </button>
          <button className="btn col-span-2" onClick={() => dispatch({ type: "navi.arrive" })}>
            목적지 도착 (onDestinationArrived)
          </button>
        </div>
        <div className="mt-1 text-[11px] text-muted">
          {w.leg && !w.leg.arrived ? `진행 ${Math.round((w.leg.progressBaseSec / w.leg.totalBaseSec) * 100)}% · 정체 ×${w.leg.factor.toFixed(2)}` : "진행 중인 경로 없음"}
        </div>
      </Card>

      <Card title="Gleo (운전자 음성)" sub="주행 중 화면 대신 말로">
        <div className="grid grid-cols-2 gap-1">
          <button className="btn btn-primary" onClick={() => dispatch({ type: "voice.yes" })} data-testid="voice-yes">
            운전자 음성: 「그래」
          </button>
          <button className="btn" onClick={() => dispatch({ type: "voice.no" })} data-testid="voice-no">
            운전자 음성: 「아니」
          </button>
          <button className="btn" onClick={() => dispatch({ type: "voice.command", intent: "READ_NEXT_JOB" })}>
            「다음 어디야?」
          </button>
          <button className="btn" onClick={() => dispatch({ type: "voice.command", intent: "CHANGE_TO_PARKING" })}>
            「주차장 입구로 바꿔」
          </button>
          <button className="btn col-span-2" onClick={() => dispatch({ type: "voice.command", intent: "NOTIFY_DELAY" })}>
            「늦는다고 알려 줘」
          </button>
          <button className="btn col-span-2" onClick={listen} disabled={listening}>
            {listening ? "듣는 중…" : "마이크로 말하기 (선택 · 브라우저 음성 인식)"}
          </button>
        </div>
        {heard && <div className="mt-1 text-[11px] text-muted">{heard}</div>}
      </Card>

      <Card title="기타">
        <div className="flex flex-wrap gap-1">
          <button className="btn" onClick={() => dispatch({ type: "car.touch" })}>
            차량 화면 터치 시도
          </button>
          <button className="btn" onClick={() => dispatch({ type: "day.finish" })}>
            하루 마무리 (C8 요약)
          </button>
        </div>
      </Card>
    </div>
  );
}
