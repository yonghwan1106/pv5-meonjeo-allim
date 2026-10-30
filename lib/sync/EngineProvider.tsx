"use client";
/**
 * 탭 간 동기화 — 같은 브라우저의 여러 탭(/demo, /car, /companion, /c/[token], /ops, /sim)이 하나의 시연 상태를 공유한다.
 * - 한 탭이 「주(master)」로 엔진을 돌리고 상태를 BroadcastChannel로 뿌린다. 나머지는 입력만 보낸다.
 * - 주 탭이 닫히면 다른 탭이 마지막 상태를 이어받는다.
 * - 서버 저장 없음. 실서비스는 서버(HTTPS API) + 서버 푸시로 바뀐다 (README).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DemoEngine } from "../engine/engine";
import type { EngineAction, EngineState } from "../engine/types";

const CHANNEL = "pv5-meonjeo-allim-v1";
const TICK_MS = 100;

type Role = "pending" | "master" | "follower";
type Msg =
  | { t: "hello"; from: string }
  | { t: "state"; from: string; s: EngineState }
  | { t: "action"; from: string; a: EngineAction }
  | { t: "bye"; from: string; s: EngineState | null };

interface Ctx {
  s: EngineState | null;
  dispatch: (a: EngineAction) => void;
  role: Role;
  peers: number;
}

const EngineCtx = createContext<Ctx>({ s: null, dispatch: () => {}, role: "pending", peers: 0 });

export function useEngine(): Ctx {
  return useContext(EngineCtx);
}

export function EngineProvider({ children, initialScenario }: { children: React.ReactNode; initialScenario?: string }) {
  const [view, setView] = useState<{ s: EngineState | null; v: number }>({ s: null, v: 0 });
  const [role, setRole] = useState<Role>("pending");
  const [peers, setPeers] = useState(0);
  const idRef = useRef(Math.random().toString(36).slice(2, 10));
  const roleRef = useRef<Role>("pending");
  const engineRef = useRef<DemoEngine | null>(null);
  const chRef = useRef<BroadcastChannel | null>(null);
  const lastStateMsg = useRef(0);
  const lastSnapshot = useRef<EngineState | null>(null);
  const peersSeen = useRef<Map<string, number>>(new Map());
  const lastBroadcast = useRef(0);
  const counter = useRef(0);

  const publish = useCallback((force = false) => {
    const e = engineRef.current;
    if (!e) return;
    counter.current++;
    setView({ s: e.s, v: counter.current });
    const now = Date.now();
    const anyPeer = [...peersSeen.current.values()].some((t) => now - t < 7000);
    if (chRef.current && anyPeer && (force || now - lastBroadcast.current > 180)) {
      lastBroadcast.current = now;
      try {
        chRef.current.postMessage({ t: "state", from: idRef.current, s: e.s } satisfies Msg);
      } catch {
        /* 직렬화 실패 시 다음 틱에 재시도 */
      }
    }
  }, []);

  const becomeMaster = useCallback(
    (snapshot: EngineState | null) => {
      const e = snapshot ? new DemoEngine(snapshot) : new DemoEngine();
      if (!snapshot) {
        // 주소로 시작 시나리오·단계 지정: /demo?s=S3&step=4
        const q = new URLSearchParams(window.location.search);
        const sc = q.get("s") ?? initialScenario;
        const step = Number(q.get("step") ?? "0");
        try {
          if (sc && sc !== "S1") e.dispatch({ type: "ctl.load", scenarioId: sc });
          if (step > 0) e.dispatch({ type: "ctl.jump", index: step });
        } catch {
          /* 잘못된 주소 값은 무시 */
        }
      }
      engineRef.current = e;
      roleRef.current = "master";
      setRole("master");
      publish(true);
    },
    [initialScenario, publish],
  );

  const dispatch = useCallback(
    (a: EngineAction) => {
      if (roleRef.current === "master" && engineRef.current) {
        engineRef.current.dispatch(a);
        publish(true);
      } else if (chRef.current) {
        chRef.current.postMessage({ t: "action", from: idRef.current, a } satisfies Msg);
      }
    },
    [publish],
  );

  useEffect(() => {
    const id = idRef.current;
    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      ch = new BroadcastChannel(CHANNEL);
      chRef.current = ch;
    }

    const onMsg = (ev: MessageEvent<Msg>) => {
      const m = ev.data;
      if (!m || m.from === id) return;
      peersSeen.current.set(m.from, Date.now());
      setPeers([...peersSeen.current.values()].filter((t) => Date.now() - t < 7000).length);
      if (m.t === "hello") {
        if (roleRef.current === "master") publish(true);
      } else if (m.t === "state") {
        lastStateMsg.current = Date.now();
        if (roleRef.current === "master") {
          // 주 탭이 둘이면 id가 작은 쪽이 남는다
          if (m.from < id) {
            engineRef.current = null;
            roleRef.current = "follower";
            setRole("follower");
          } else return;
        }
        if (roleRef.current === "pending") {
          roleRef.current = "follower";
          setRole("follower");
        }
        lastSnapshot.current = m.s;
        counter.current++;
        setView({ s: m.s, v: counter.current });
      } else if (m.t === "action") {
        if (roleRef.current === "master" && engineRef.current) {
          engineRef.current.dispatch(m.a);
          publish(true);
        }
      } else if (m.t === "bye") {
        if (m.s) lastSnapshot.current = m.s;
        if (roleRef.current === "follower") {
          const wait = 150 + Math.random() * 400;
          const since = Date.now();
          setTimeout(() => {
            if (roleRef.current === "follower" && lastStateMsg.current < since) becomeMaster(lastSnapshot.current);
          }, wait);
        }
      }
    };
    ch?.addEventListener("message", onMsg);
    ch?.postMessage({ t: "hello", from: id } satisfies Msg);

    // 0.7초 안에 주 탭 응답이 없으면 내가 주 탭
    const elect = setTimeout(() => {
      if (roleRef.current === "pending") becomeMaster(null);
    }, ch ? 700 : 0);

    let last = performance.now();
    const loop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, now - last);
      last = now;
      if (roleRef.current === "master" && engineRef.current) {
        let changed = false;
        try {
          changed = engineRef.current.tick(dt);
        } catch (err) {
          console.warn("engine tick", err);
        }
        if (changed) publish();
      } else if (roleRef.current === "follower") {
        if (Date.now() - lastStateMsg.current > 3500) becomeMaster(lastSnapshot.current);
      }
    }, TICK_MS);

    const heartbeat = setInterval(() => {
      if (roleRef.current === "follower") ch?.postMessage({ t: "hello", from: id } satisfies Msg);
      if (roleRef.current === "master") publish(true);
    }, 1500);

    const bye = () => {
      if (roleRef.current === "master" && engineRef.current) {
        try {
          ch?.postMessage({ t: "bye", from: id, s: engineRef.current.s } satisfies Msg);
        } catch {
          /* 무시 */
        }
      }
    };
    window.addEventListener("pagehide", bye);

    return () => {
      bye();
      window.removeEventListener("pagehide", bye);
      clearTimeout(elect);
      clearInterval(loop);
      clearInterval(heartbeat);
      ch?.removeEventListener("message", onMsg);
      ch?.close();
      chRef.current = null;
      engineRef.current = null;
      roleRef.current = "pending";
    };
  }, [becomeMaster, publish]);

  return <EngineCtx.Provider value={{ s: view.s, dispatch, role, peers }}>{children}</EngineCtx.Provider>;
}

export function SyncBadge() {
  const { role, peers } = useEngine();
  const label = role === "master" ? "이 탭이 시연 엔진을 돌림" : role === "follower" ? "다른 탭과 동기화 중" : "연결 중…";
  return (
    <span className="badge" style={{ color: role === "follower" ? "var(--ok)" : "var(--muted)" }} title="같은 브라우저 탭끼리 BroadcastChannel로 동기화 (서버 저장 없음)">
      {label}
      {peers > 0 ? ` · 탭 ${peers + 1}개` : ""}
    </span>
  );
}
