/**
 * 안내 자막의 숫자를 엔진 값으로 채운다 — 자막에 시각·분을 손으로 적지 않는다(화면 값과 1분씩 어긋나는 문제 방지).
 *
 * 시나리오 JSON의 자막 문자열에 `{이름}` 또는 `{이름:jobId}`를 쓰면, 그 단계를 화면에 그리는 순간의 엔진 상태로 바뀐다.
 * 차량 화면·고객 화면과 같은 함수(fmtHHMM·fmtWindow·shownDiffMin)를 써서 글자 하나까지 같게 만든다.
 *
 * | 이름 | 값 | 화면에서 같은 값이 보이는 곳 |
 * |---|---|---|
 * | now | 지금 시각 | 차량 화면 상태바 |
 * | eta | 내비 도착 예정(TripInfo.eta) | 내비 「도착 예정」·주행 화면 「도착 …」 |
 * | promised[:J] | 약속 시각 (생략 시 내비 목적지 고객) | 주행 화면 「약속 …」 |
 * | delay | 도착 예정 − 약속 (화면 표기, 「+22분」「정시」「−39분」) | 주행 화면 괄호 |
 * | early | 「39분 일찍」/「1분 늦게」 | 〃 |
 * | ask | Gleo가 지금 묻는 문장 (없으면 마지막 Gleo 음성) | Gleo 카드·음성 자막 |
 * | reply | Gleo Callback 자막 (없으면 마지막 음성) | Gleo Callback 상자 |
 * | said | 마지막 음성 자막 | 음성 자막 상자 |
 * | win:J | 고객에게 보낸 도착 예정 범위 | 고객 휴대폰 큰 글씨 |
 * | sentN:J | 고객에게 보낸 지연 분(5분 단위) | 고객 알림 「약 N분」 |
 * | notice:J | 그 고객에게 마지막으로 보낸 알림 본문 | 고객 휴대폰 받은 알림 |
 * | remainKm / remainMin | 남은 거리(km, 소수 1자리) / 남은 시간(분) | 내비 「남은 거리」 |
 * | overEta / overN | 작업 초과 시 다음 고객 도착 예상 / 지연 분 | 차량 C7 빨간 카드 |
 * | work | 지금 작업 몇 분째 | 차량 C7 「작업 N분째」 |
 */
import type { EngineState, Job } from "./types";
import { delayForMessage } from "../logic/delay";
import { fmtHHMM, fmtWindow } from "../logic/time";

/** 화면에 찍힌 두 시각(분 단위 내림)의 차이 — 「11:34 · 약속 11:00 (+34분)」처럼 산수가 맞게 */
export function shownDiffMin(etaMin: number, promisedMin: number): number {
  return Math.floor(etaMin + 1e-9) - Math.floor(promisedMin + 1e-9);
}

export function fmtDiff(d: number): string {
  return d > 0 ? `+${d}분` : d === 0 ? "정시" : `−${-d}분`;
}

export const NA = "(값 없음)";

function routeJob(s: EngineState): Job | undefined {
  return s.server.jobs.find((j) => j.id === s.app.route?.jobId);
}

function jobOf(s: EngineState, id: string | undefined): Job | undefined {
  return id ? s.server.jobs.find((j) => j.id === id) : routeJob(s);
}

function lastSpeech(s: EngineState, source?: "GLEO" | "APP"): string | undefined {
  for (let i = s.speech.length - 1; i >= 0; i--) {
    if (!source || s.speech[i].source === source) return s.speech[i].text;
  }
  return undefined;
}

function resolve(s: EngineState, name: string, arg: string | undefined): string | undefined {
  const app = s.app;
  const trip = app.trip;
  switch (name) {
    case "now":
      return fmtHHMM(s.clockSec / 60);
    case "eta":
      return trip ? fmtHHMM(trip.etaMin) : undefined;
    case "promised": {
      const j = jobOf(s, arg);
      return j ? fmtHHMM(j.promisedMin) : undefined;
    }
    case "delay": {
      const j = routeJob(s);
      return trip && j ? fmtDiff(shownDiffMin(trip.etaMin, j.promisedMin)) : undefined;
    }
    case "early": {
      const j = routeJob(s);
      if (!trip || !j) return undefined;
      const d = shownDiffMin(trip.etaMin, j.promisedMin);
      return d < 0 ? `${-d}분 일찍` : d === 0 ? "정시" : `${d}분 늦게`;
    }
    case "ask":
      return app.gleo?.promptKo ?? lastSpeech(s, "GLEO");
    case "reply":
      return app.gleoResult?.subtitleKo ?? lastSpeech(s);
    case "said":
      return lastSpeech(s);
    case "win": {
      const j = jobOf(s, arg);
      return j && j.notifiedEtaMin !== null ? fmtWindow(j.notifiedEtaMin) : undefined;
    }
    case "sentN": {
      const j = jobOf(s, arg);
      const v = j ? app.notified[j.id] : undefined;
      return typeof v === "number" ? String(delayForMessage(v)) : undefined;
    }
    case "notice": {
      const j = jobOf(s, arg);
      if (!j) return undefined;
      for (let i = s.server.notices.length - 1; i >= 0; i--) if (s.server.notices[i].jobId === j.id) return s.server.notices[i].body;
      return undefined;
    }
    case "remainKm":
      return trip ? (trip.remainDistM / 1000).toFixed(1) : undefined;
    case "remainMin":
      return trip ? String(Math.max(0, Math.round(trip.remainTimeSec / 60))) : undefined;
    case "overEta": {
      const v = app.overrun?.etaMin ?? (app.lastAsk?.reason === "OVERRUN" ? app.lastAsk.etaMin : undefined);
      return typeof v === "number" ? fmtHHMM(v) : undefined;
    }
    case "overN": {
      const v = app.overrun?.delayMin ?? (app.lastAsk?.reason === "OVERRUN" ? app.lastAsk.delayMin : undefined);
      return typeof v === "number" ? String(delayForMessage(v)) : undefined;
    }
    case "work": {
      const j = s.server.jobs.find((x) => x.id === app.currentJobId);
      return j && j.workStartedAt !== null ? String(Math.max(0, Math.floor(s.clockSec / 60 - j.workStartedAt))) : undefined;
    }
    default:
      return undefined;
  }
}

const VAR = /\{([a-zA-Z]+)(?::([A-Za-z0-9_]+))?\}/g;

/** 자막 한 줄의 `{이름}`을 지금 엔진 값으로 채운다. 값이 없으면 「(값 없음)」. */
export function fillCaption(text: string, s: EngineState): string {
  return text.replace(VAR, (_m, name: string, arg: string | undefined) => resolve(s, name, arg) ?? NA);
}

/** 자막에 쓴 변수 이름 목록 (테스트용) */
export function captionVarNames(text: string): string[] {
  return [...text.matchAll(VAR)].map((m) => m[1]);
}
