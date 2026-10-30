"use client";
/**
 * 음성 출력 = 브라우저 Web Speech API(ko-KR). Pleos TextToSpeech SDK는 「준비 중」이라 모의.
 * 소리가 꺼져 있어도 화면 자막으로 같은 내용을 보여 준다.
 */
import { useEffect, useRef } from "react";
import type { EngineState } from "@/lib/engine/types";

export function speakNow(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 1.05;
    const ko = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("ko"));
    if (ko) u.voice = ko;
    window.speechSynthesis.speak(u);
  } catch {
    /* 음성 미지원 브라우저 — 자막만 */
  }
}

export function useSpeech(state: EngineState | null, enabled: boolean) {
  const lastId = useRef<number | null>(null);
  const ref = useRef(state);
  ref.current = state;
  const seq = state?.seq ?? 0;
  useEffect(() => {
    const s = ref.current;
    if (!s) return;
    const items = s.speech;
    const maxId = items.length ? items[items.length - 1].id : 0;
    if (lastId.current === null) {
      lastId.current = maxId; // 처음 연결될 때 이전 말은 읽지 않는다
      return;
    }
    const fresh = items.filter((x) => x.id > (lastId.current ?? 0) && s.realMs - x.realMs < 2500);
    lastId.current = Math.max(lastId.current, maxId);
    if (!enabled || fresh.length === 0) return;
    const pick = fresh.length > 2 ? fresh.slice(-1) : fresh;
    for (const f of pick) speakNow(f.text);
  }, [seq, enabled]);

  useEffect(() => {
    if (!enabled) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* 무시 */
      }
    }
  }, [enabled]);
}
