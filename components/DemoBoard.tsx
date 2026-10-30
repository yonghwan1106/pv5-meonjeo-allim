"use client";
/** /demo — 한 화면 3분할: 왼쪽 시뮬레이터 · 가운데 차량 화면(12.9인치 16:9) · 오른쪽 동반 화면 + 아래 안내 자막·API 호출 기록 */
import { useEffect, useState } from "react";
import { EngineProvider, SyncBadge, useEngine } from "@/lib/sync/EngineProvider";
import CarScreen from "./CarScreen";
import Simulator from "./Simulator";
import Companion from "./Companion";
import ApiLog from "./ApiLog";
import CaptionBar from "./CaptionBar";
import { Loading } from "./ui";
import { useSpeech } from "./useSpeech";

export default function DemoBoard({ initialScenario }: { initialScenario?: string }) {
  return (
    <EngineProvider initialScenario={initialScenario}>
      <Board />
    </EngineProvider>
  );
}

function Board() {
  const { s, dispatch } = useEngine();
  const [sound, setSound] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mute") === "1") setTouched(true);
  }, []);
  useSpeech(s, sound);
  if (!s) return <Loading />;
  return (
    <main className="mx-auto w-full max-w-[1680px] px-3 py-2">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[330px_minmax(0,1fr)_360px]">
        {/* 왼쪽: 시뮬레이터 */}
        <aside className="order-2 xl:order-1 xl:max-h-[calc(100vh-268px)] xl:overflow-y-auto xl:pr-1 scroll-thin" aria-label="시뮬레이터">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">시뮬레이터 <span className="font-normal text-muted">(Virtual Console 흉내)</span></h2>
          </div>
          <Simulator
            s={s}
            dispatch={dispatch}
            onFirstPlay={() => {
              if (!touched) {
                setTouched(true);
                setSound(true);
              }
            }}
          />
        </aside>

        {/* 가운데: 차량 화면 + 자막 */}
        <section className="order-1 flex min-w-0 flex-col gap-2 xl:order-2" aria-label="차량 화면">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold">PV5 차량 화면</h2>
            <span className="text-xs text-muted">12.9인치 16:9 비율 · 왼쪽 내비(모의) · 오른쪽 「먼저 알림」 앱 창</span>
            <span className="ml-auto flex items-center gap-2">
              <SyncBadge />
              <button
                className="btn"
                aria-pressed={sound}
                onClick={() => {
                  setTouched(true);
                  setSound((v) => !v);
                }}
                data-testid="sound"
              >
                음성 {sound ? "켜짐" : "꺼짐"} (브라우저 TTS)
              </button>
            </span>
          </div>
          <div className="mx-auto w-full" style={{ maxWidth: "max(640px, calc((100vh - 468px) * 16 / 9))" }}>
            <CarScreen s={s} dispatch={dispatch} />
          </div>
          <CaptionBar s={s} dispatch={dispatch} />
        </section>

        {/* 오른쪽: 동반 화면 */}
        <aside className="order-3" aria-label="동반 화면">
          <h2 className="mb-1 text-sm font-extrabold">동반 화면 <span className="font-normal text-muted">(고객 · 업체)</span></h2>
          <p className="mb-1 text-[11px] leading-snug text-muted" data-testid="sync-note">
            고객 링크(<code>/c/…</code>)와 <code>/car</code>는 같은 브라우저의 다른 탭에서 열어야 동기화됩니다(실서비스는 서버 푸시).
          </p>
          <Companion s={s} dispatch={dispatch} height="max(420px, calc(100vh - 412px))" />
        </aside>
      </div>
      {/* 1600×900에서도 최근 4줄 이상이 잘리지 않고 보이게 — 위 3분할 높이를 줄여 화면 안에 맞춘다 */}
      <div className="mt-2">
        <ApiLog s={s} height={130} />
      </div>
    </main>
  );
}
