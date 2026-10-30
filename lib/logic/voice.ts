/** 운전자 발화 → 의도, App Schema 검증 (순수 함수). */
import { MAX_ACTION_CALLS, type AppSchema } from "../pleos/gleo";

export type VoiceIntent = "YES" | "NO" | "READ_NEXT_JOB" | "CHANGE_TO_PARKING" | "NOTIFY_DELAY";

/** 브라우저 음성 인식 결과(또는 버튼)를 의도로. 구체 명령 → 거절 → 승낙 순으로 본다. */
export function matchVoiceIntent(raw: string): VoiceIntent | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/다음.*(어디|누구|고객|손님)/.test(t)) return "READ_NEXT_JOB";
  if (/(주차장|입구로)/.test(t)) return "CHANGE_TO_PARKING";
  if (/(늦는다고|늦어진다고|지연)/.test(t)) return "NOTIFY_DELAY";
  if (/(아니|아냐|싫어|하지 ?마|됐어|안 ?돼|보내지 ?마)/.test(t)) return "NO";
  if (/(그래|응|네|예|좋아|보내|알려|그렇게)/.test(t)) return "YES";
  return null;
}

/** App Schema 규칙 위반 목록 (빈 배열이면 통과) — app-capability 원문 규칙 */
export function validateAppSchema(schema: AppSchema): string[] {
  const errors: string[] = [];
  if (!schema.packageName) errors.push("packageName 없음");
  if (/[가-힣]/.test(schema.appDescription)) errors.push("appDescription은 영어로");
  if (schema.actionCalls.length > MAX_ACTION_CALLS) errors.push(`actionCalls ${schema.actionCalls.length}개 — 최대 ${MAX_ACTION_CALLS}개`);
  const names = new Set<string>();
  for (const c of schema.actionCalls) {
    const f = c.function;
    if (!/^[A-Z]+(_[A-Z]+)*$/.test(f.name)) errors.push(`${f.name}: 이름은 대문자_밑줄`);
    if (names.has(f.name)) errors.push(`${f.name}: 이름 중복`);
    names.add(f.name);
    if (/[가-힣]/.test(f.description)) errors.push(`${f.name}: description은 영어로`);
    if (c.type !== "function") errors.push(`${f.name}: type은 "function"`);
    for (const [k, p] of Object.entries(f.parameters.properties)) {
      if (!["string", "number", "boolean", "array"].includes(p.type)) errors.push(`${f.name}.${k}: 지원하지 않는 type`);
      if (/[가-힣]/.test(p.description)) errors.push(`${f.name}.${k}: description은 영어로`);
    }
    for (const r of f.parameters.required) {
      if (!(r in f.parameters.properties)) errors.push(`${f.name}: required ${r}가 properties에 없음`);
    }
  }
  return errors;
}
