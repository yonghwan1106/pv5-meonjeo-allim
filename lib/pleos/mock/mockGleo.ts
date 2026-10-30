/**
 * Gleo Interface 모의 — 운전자의 「그래/아니」는 시뮬레이터 버튼(또는 선택적 브라우저 음성 인식)으로 흉내 낸다.
 * 실제로는 Gleo AI(OS 상위 레이어)가 듣고, App Schema의 함수를 Intent로 앱에 넘긴다.
 */
import type { GleoPending } from "../../engine/types";
import {
  APP_ACTION_RESPONSE,
  GLEO_TIMEOUT_MS,
  type GleoAction,
  type GleoCallback,
  type GleoInterface,
  type ProactiveSuggestion,
} from "../gleo";
import type { MockHub } from "./hub";
import schema from "../../../data/gleo-app-schema.json";

export type DismissReason = "NO" | "TIMEOUT" | "CANCELLED";

export class MockGleo implements GleoInterface {
  private handler: ((a: GleoAction) => void) | null = null;
  private dismissHandler: ((p: GleoPending, reason: DismissReason) => void) | null = null;
  constructor(private hub: MockHub) {}

  setActionHandler(handler: (action: GleoAction) => void): void {
    this.handler = handler;
    this.hub.log("GLEO", "App Schema 등록", `actionCalls ${schema.actionCalls.map((a) => a.function.name).join(" · ")} (최대 3)`);
  }
  /** [가정] 제안이 거절·시간 초과됐음을 앱에 알려 주는 통로 (문서 미확인) */
  setSuggestionDismissedHandler(h: (p: GleoPending, reason: DismissReason) => void): void {
    this.dismissHandler = h;
  }

  requestProactiveSuggestion(s: ProactiveSuggestion & { jobId: string; reason: GleoPending["reason"] }): void {
    const app = this.hub.app();
    app.gleo = {
      functionName: s.functionName as GleoPending["functionName"],
      promptKo: s.promptKo,
      params: s.actionParameters,
      jobId: s.jobId,
      reason: s.reason,
      remainingMs: GLEO_TIMEOUT_MS,
      retried: false,
    };
    app.gleoResult = null;
    this.hub.log("GLEO", `제안(asking) ${s.functionName} [가정: proactive]`, s.promptKo);
    this.hub.speak(s.promptKo, "GLEO");
  }

  /** 앱 쪽에서 질문을 거둬들임 (예: 기어 P에서 터치로 답함) */
  cancelSuggestion(): void {
    const p = this.hub.app().gleo;
    if (!p) return;
    this.hub.app().gleo = null;
    this.hub.log("GLEO", "제안 닫힘", "화면 터치로 답함");
  }

  sendGleoBroadcast(cb: GleoCallback & { subtitleKo: string }): void {
    const { subtitleKo, ...callback } = cb;
    this.hub.log("GLEO", `${APP_ACTION_RESPONSE.split(".").pop()} ← ${callback.functionName} ${callback.status}`, `"${callback.message}"`);
    this.hub.app().gleoResult = {
      functionName: callback.functionName,
      status: callback.status,
      message: callback.message,
      subtitleKo,
      untilRealMs: this.hub.realMs() + 4000,
    };
    if ((callback.mode ?? "voice") !== "silent") this.hub.speak(subtitleKo, "GLEO");
  }

  private invoke(action: string, params: GleoAction["actionParameters"]): void {
    const a: GleoAction = { packageName: schema.packageName, action, actionParameters: params };
    this.hub.log("GLEO", `Intent action=${action}`, `ACTION_PARAM=${JSON.stringify(params)}`);
    this.handler?.(a);
  }

  // ------------------------------------------------------------------ 시뮬레이터 전용
  simUserYes(): void {
    const p = this.hub.app().gleo;
    this.hub.log("SIM", "운전자 음성 「그래」");
    if (!p) {
      this.hub.log("GLEO", "대기 중인 질문 없음");
      return;
    }
    this.hub.app().gleo = null;
    this.invoke(p.functionName, p.params);
  }

  simUserNo(): void {
    const p = this.hub.app().gleo;
    this.hub.log("SIM", "운전자 음성 「아니」");
    if (!p) {
      this.hub.log("GLEO", "대기 중인 질문 없음");
      return;
    }
    this.hub.app().gleo = null;
    this.hub.log("GLEO", "함수 호출 안 함", "운전자가 거절");
    this.hub.speak("알겠어요. 보내지 않을게요.", "GLEO");
    this.dismissHandler?.(p, "NO");
  }

  simCommand(fn: string, params: GleoAction["actionParameters"] = {}): void {
    const label: Record<string, string> = {
      READ_NEXT_JOB: "「다음 어디야?」",
      CHANGE_TO_PARKING: "「주차장 입구로 바꿔」",
      NOTIFY_DELAY: "「늦는다고 알려 줘」",
    };
    this.hub.log("SIM", `운전자 음성 ${label[fn] ?? fn}`);
    // 대기 중인 같은 질문이 있으면 승낙으로 처리
    const p = this.hub.app().gleo;
    if (p && p.functionName === fn) {
      this.simUserYes();
      return;
    }
    this.invoke(fn, params);
  }

  /** 7초 타임아웃 (재생 중에만 흐름) — 무응답이면 1회 다시 묻고, 그래도 없으면 fail */
  simTick(realDtMs: number): boolean {
    const app = this.hub.app();
    const p = app.gleo;
    if (!p) return false;
    const before = Math.ceil(p.remainingMs / 1000);
    p.remainingMs -= realDtMs;
    if (p.remainingMs <= 0) {
      if (!p.retried) {
        p.retried = true;
        p.remainingMs = GLEO_TIMEOUT_MS;
        this.hub.log("GLEO", "7초 무응답 → 한 번 더 묻기");
        this.hub.speak(p.promptKo, "GLEO");
      } else {
        app.gleo = null;
        this.hub.log("GLEO", `${p.functionName} fail`, '"A timeout occurred while processing the request."');
        this.dismissHandler?.(p, "TIMEOUT");
      }
      return true;
    }
    return Math.ceil(p.remainingMs / 1000) !== before;
  }
}
