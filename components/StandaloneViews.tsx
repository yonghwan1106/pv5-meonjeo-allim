"use client";
/** 단독 화면들 — 같은 브라우저의 다른 탭과 BroadcastChannel로 동기화 (실제 두 기기 시연은 서버 푸시가 필요 — README) */
import { useState } from "react";
import { EngineProvider, SyncBadge, useEngine } from "@/lib/sync/EngineProvider";
import CarScreen from "./CarScreen";
import Simulator from "./Simulator";
import Companion from "./Companion";
import CustomerView from "./CustomerView";
import OpsView from "./OpsView";
import ApiLog from "./ApiLog";
import CaptionBar from "./CaptionBar";
import { Loading } from "./ui";
import { useSpeech } from "./useSpeech";
import day from "@/data/day.json";

function SyncNote() {
  return (
    <p className="text-xs text-muted">
      같은 브라우저에서 <a href="/demo">/demo</a>·<a href="/sim">/sim</a> 탭을 함께 열면 상태가 실시간으로 맞춰져요 (서버 저장 없음, BroadcastChannel). <SyncBadge />
    </p>
  );
}

function CarInner() {
  const { s, dispatch } = useEngine();
  const [sound, setSound] = useState(false);
  useSpeech(s, sound);
  if (!s) return <Loading />;
  return (
    <main className="mx-auto flex w-full max-w-[min(1600px,calc((100vh-130px)*16/9))] flex-col gap-2 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-extrabold">차량 화면 단독 (전시·녹화용)</h1>
        <span className="ml-auto" />
        <button className="btn" aria-pressed={sound} onClick={() => setSound((v) => !v)}>
          음성 {sound ? "켜짐" : "꺼짐"}
        </button>
      </div>
      <CarScreen s={s} dispatch={dispatch} />
      <SyncNote />
    </main>
  );
}

export function CarStandalone() {
  return (
    <EngineProvider>
      <CarInner />
    </EngineProvider>
  );
}

function CompanionInner() {
  const { s, dispatch } = useEngine();
  if (!s) return <Loading />;
  return (
    <main className="mx-auto w-full max-w-[420px] px-3 py-3">
      <h1 className="mb-2 text-base font-extrabold">동반 화면 (고객 휴대폰 · 업체 관제)</h1>
      <Companion s={s} dispatch={dispatch} height="calc(100vh - 210px)" />
      <div className="mt-2">
        <SyncNote />
      </div>
    </main>
  );
}

export function CompanionStandalone() {
  return (
    <EngineProvider>
      <CompanionInner />
    </EngineProvider>
  );
}

function CustomerInner({ token }: { token: string }) {
  const { s, dispatch } = useEngine();
  if (!s) return <Loading label="링크 확인 중…" />;
  const job = s.server.jobs.find((j) => j.token === token);
  return (
    <main className="mx-auto w-full max-w-[440px] px-2 py-2">
      <div className="phone" style={{ height: "calc(100vh - 120px)", minHeight: 560 }}>
        {job ? <CustomerView s={s} dispatch={dispatch} jobId={job.id} /> : <div className="p-6 text-sm text-[#15181c]">링크가 만료되었거나 잘못된 주소예요.</div>}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        시제품 링크 — 같은 브라우저의 /demo 탭과 동기화돼요. 실서비스에서는 서버가 알림톡으로 이 링크를 보내고, 서버 푸시로 바뀝니다.
      </p>
    </main>
  );
}

export function CustomerStandalone({ token }: { token: string }) {
  return (
    <EngineProvider>
      <CustomerInner token={token} />
    </EngineProvider>
  );
}

function OpsInner() {
  const { s } = useEngine();
  if (!s) return <Loading />;
  return (
    <main className="mx-auto w-full max-w-[980px] px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-base font-extrabold">업체 관제 — {day.driver.company}</h1>
      </div>
      <div className="overflow-hidden rounded-xl border border-line" style={{ height: "calc(100vh - 170px)", minHeight: 520 }}>
        <OpsView s={s} />
      </div>
      <div className="mt-2">
        <SyncNote />
      </div>
    </main>
  );
}

export function OpsStandalone() {
  return (
    <EngineProvider>
      <OpsInner />
    </EngineProvider>
  );
}

function SimInner() {
  const { s, dispatch } = useEngine();
  if (!s) return <Loading />;
  return (
    <main className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-3 px-3 py-3 lg:grid-cols-[360px_1fr]">
      <div>
        <h1 className="mb-2 text-base font-extrabold">시뮬레이터 단독 (발표자 조작용)</h1>
        <Simulator s={s} dispatch={dispatch} />
      </div>
      <div className="flex flex-col gap-3">
        <CaptionBar s={s} dispatch={dispatch} />
        <ApiLog s={s} height={420} />
        <SyncNote />
      </div>
    </main>
  );
}

export function SimStandalone() {
  return (
    <EngineProvider>
      <SimInner />
    </EngineProvider>
  );
}
