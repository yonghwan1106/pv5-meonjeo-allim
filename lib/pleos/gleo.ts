/**
 * Pleos **Gleo Interface**(앱 통합) 모양 — App Schema / Gleo Action / Callback Schema.
 *
 * 원문 근거
 * - app-integration-guide/guide/app-capability: packageName·appDescription·invokeWord·version·
 *   actionCalls(최대 3개, name은 대문자_밑줄, component activity|service), description은 영어
 * - action_callback: functionName·status(success|asking|fail)·message(영어 완전한 문장)·mode(voice|beep|silent)·data,
 *   「Gleo는 timeout을 위해 7초 후 Action을 취소합니다」
 * - examples: Gleo → Intent(action=함수명, ACTION_PARAM extra) → 앱,
 *   앱 → Broadcast "ai.pleos.playground.intent.action.APP_ACTION_RESPONSE" (packageName, response)
 *
 * [가정] 앱이 먼저 Gleo 대화를 여는 「proactive suggestion」이 서드파티에 열려 있는지는 문서 미확인.
 * 대체안 = 앱 알림 카드 + 비프 후 운전자가 호출어로 답하기. (requestProactiveSuggestion 은 시제품 전용 이름)
 */

export const MAX_ACTION_CALLS = 3;
export const GLEO_TIMEOUT_MS = 7000;
export const APP_ACTION_RESPONSE = "ai.pleos.playground.intent.action.APP_ACTION_RESPONSE";

export type GleoParamType = "string" | "number" | "boolean" | "array";

export interface ActionCall {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: GleoParamType; description: string; enum?: string[] }>;
      required: string[];
    };
    component: "activity" | "service";
  };
}

export interface AppSchema {
  packageName: string;
  appDescription: string;
  invokeWord: string;
  version: string;
  actionCalls: ActionCall[];
}

/** Gleo가 사용자 발화를 해석해 만드는 객체 (examples 1.1) */
export interface GleoAction {
  packageName: string;
  action: string;
  actionParameters: Record<string, string | number | boolean>;
}

export type GleoStatus = "success" | "asking" | "fail";
export type GleoMode = "voice" | "beep" | "silent";

/** Callback Schema */
export interface GleoCallback {
  functionName: string;
  status: GleoStatus;
  message: string;
  mode?: GleoMode;
  data?: string;
}

export interface ProactiveSuggestion {
  functionName: string;
  /** 운전자에게 들려줄 한국어 질문 (자막·TTS 모의) */
  promptKo: string;
  actionParameters: Record<string, string | number | boolean>;
}

export interface GleoInterface {
  /** Intent(action=함수명)로 들어오는 Gleo Action 수신 — 실제로는 Activity/BroadcastReceiver */
  setActionHandler(handler: (action: GleoAction) => void): void;
  /** APP_ACTION_RESPONSE 브로드캐스트로 결과 회신 */
  sendGleoBroadcast(callback: GleoCallback & { subtitleKo: string }): void;
  /** [가정] 서드파티 proactive 제안 — 문서 미확인 */
  requestProactiveSuggestion(s: ProactiveSuggestion): void;
}
