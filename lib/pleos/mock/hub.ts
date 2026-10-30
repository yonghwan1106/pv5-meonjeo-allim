/**
 * 모의(Mock) SDK들이 공유하는 연결점. 실제 차량에서는 이 자리를 Vehicle Service·Navi Service·Gleo가 대신한다.
 * 모의 구현은 시뮬레이터가 바꾼 World 값을 읽고, 바뀌면 등록된 리스너를 동기적으로 호출한다
 * (실제 SDK는 IPC 비동기 — 앱 로직은 콜백 기반이라 그대로 옮겨진다).
 */
import type { CarAppState, Layer, World } from "../../engine/types";

export interface MockHub {
  world(): World;
  app(): CarAppState;
  nowSec(): number;
  realMs(): number;
  log(layer: Layer, name: string, detail?: string): void;
  speak(text: string, source: "GLEO" | "APP"): void;
}
