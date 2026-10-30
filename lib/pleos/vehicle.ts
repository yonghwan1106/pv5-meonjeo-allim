/**
 * Pleos Connect **Vehicle SDK v2.3.2** 모양 인터페이스 (웹 시제품용).
 *
 * 원문 근거
 * - document.pleos.ai/docs/pleos-only/connect-sdk-pleos/Vehicle/intro
 *   「도메인 객체는 직접 생성하지 않고, Vehicle 인스턴스의 getDoor(), getBrake()와 같은 getXxx()로만 얻습니다」
 *   「capability·get·set 결과는 즉시 반환되지 않고 onComplete·onFailed 비동기 람다로 전달」
 * - Sample App 표: checkDoorPositionCapabilities / getCurrentDoorPosition / registerDoorPosition /
 *   setDoorPosition / unregisterDoorPosition, Door Position 범위 0..1 (Closed 0 / Open 1)
 * - 권한: 조회 pleos.car.permission.CAR_*, 제어 CONTROL_CAR_* (Manifest 선언)
 *
 * 메서드 이름은 문서 원문 그대로다. 인자 구성(area·람다 순서)은 문서 미확인이라 [가정]이며,
 * 실제 SDK로 바꿀 때는 lib/pleos/mock/* 만 교체하면 된다 (docs/PLEOS_PORTING.md).
 */

/** Pleos DoorValue 상수 중 이 앱이 쓰는 것. PV5 카고 뒷문 = REAR 매핑은 [가정] (실차 미확인). */
export type DoorValue = "ROW_1_LEFT" | "ROW_1_RIGHT" | "ROW_2_RIGHT" | "REAR";
/** Pleos SeatValue 상수 일부 */
export type SeatValue = "ROW_1_LEFT" | "ROW_1_RIGHT";

/** Door Position 값 범위 0..1 (Sample App 원문: Closed (0) / Open (1)) */
export type DoorPositionValue = 0 | 1;
export type DoorLockValue = "LOCKED" | "UNLOCKED";
export type SeatOccupancyValue = "OCCUPIED" | "EMPTY";

export interface VehicleError {
  code: string;
  message: string;
}
export type OnComplete<T> = (value: T) => void;
export type OnFailed = (error: VehicleError) => void;

export interface DoorPositionCapability {
  supported: boolean;
  areas: DoorValue[];
  range: [number, number];
  writable: boolean;
}

export type DoorPositionListener = (area: DoorValue, value: DoorPositionValue) => void;
export type DoorLockListener = (area: DoorValue, value: DoorLockValue) => void;
export type SocListener = (socPercent: number) => void;
export type SeatOccupancyListener = (area: SeatValue, value: SeatOccupancyValue) => void;

/** 권한: CAR_DOORS (조회·구독), CONTROL_CAR_DOORS (제어) */
export interface Door {
  checkDoorPositionCapabilities(onComplete: OnComplete<DoorPositionCapability>, onFailed: OnFailed): void;
  getCurrentDoorPosition(area: DoorValue, onComplete: OnComplete<DoorPositionValue>, onFailed: OnFailed): void;
  registerDoorPosition(area: DoorValue, listener: DoorPositionListener): void;
  unregisterDoorPosition(area: DoorValue, listener: DoorPositionListener): void;
  getDoorLockState(area: DoorValue, onComplete: OnComplete<DoorLockValue>, onFailed: OnFailed): void;
  registerDoorLockState(area: DoorValue, listener: DoorLockListener): void;
  unregisterDoorLockState(area: DoorValue, listener: DoorLockListener): void;
  /**
   * @status preparing — Vehicle Control SDK 「준비 중(Coming Soon)」 (create-my-project 원문).
   * 이 앱은 문을 열고 닫지 않는다. SDK 공개 시 연동.
   */
  setDoorPosition?(area: DoorValue, value: DoorPositionValue, onComplete: OnComplete<DoorPositionValue>, onFailed: OnFailed): void;
  /** @status preparing — Vehicle Control SDK 「준비 중」 */
  setDoorLock?(area: DoorValue, value: DoorLockValue, onComplete: OnComplete<DoorLockValue>, onFailed: OnFailed): void;
}

/** 권한: CAR_ENERGY */
export interface EvBattery {
  getEvBatteryStateOfCharge(onComplete: OnComplete<number>, onFailed: OnFailed): void;
  registerEvBatteryStateOfCharge(listener: SocListener): void;
  unregisterEvBatteryStateOfCharge(listener: SocListener): void;
  /** @status preparing — Vehicle Control SDK 「준비 중」 */
  setEvChargePercentLimit?(percent: number, onComplete: OnComplete<number>, onFailed: OnFailed): void;
}

/** 권한: CAR_SEATS */
export interface Seat {
  getCurrentSeatOccupancy(area: SeatValue, onComplete: OnComplete<SeatOccupancyValue>, onFailed: OnFailed): void;
  registerSeatOccupancy(area: SeatValue, listener: SeatOccupancyListener): void;
  unregisterSeatOccupancy(area: SeatValue, listener: SeatOccupancyListener): void;
}

/** 권한: CAR_DRIVE */
export interface Odometer {
  getCurrentDistanceDriven(onComplete: OnComplete<number>, onFailed: OnFailed): void;
}

/** 권한: CAR_INFO */
export interface CarInfo {
  getVINInfo(onComplete: OnComplete<string>, onFailed: OnFailed): void;
}

/** Vehicle SDK 진입점 — 도메인 객체는 getXxx()로만 얻는다 (원문). */
export interface Vehicle {
  initialize(): void;
  release(): void;
  getDoor(): Door;
  getEvBattery(): EvBattery;
  getSeat(): Seat;
  getOdometer(): Odometer;
  getCarInfo(): CarInfo;
}

/** 이 앱이 Manifest에 선언할 최소 권한 (조회만, 제어 권한 없음) */
export const REQUIRED_VEHICLE_PERMISSIONS = [
  "pleos.car.permission.CAR_DOORS",
  "pleos.car.permission.CAR_ENERGY",
  "pleos.car.permission.CAR_SEATS",
  "pleos.car.permission.CAR_DRIVE",
  "pleos.car.permission.CAR_INFO",
] as const;
