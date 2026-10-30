/**
 * AAOS 표준 Car API 모양 인터페이스 — 기어·차속은 Pleos Vehicle SDK가 아니라 AAOS 표준으로 읽는다.
 *
 * 원문 근거
 * - Pleos 「API 선택 원칙」: 표준 데이터(속도·기어·외기온도·연료)는 AAOS Car API, 제조사 특화만 Pleos SDK
 * - Pleos FAQ: 「CarPropertyManager로 PERF_VEHICLE_SPEED를 읽습니다」
 * - GEAR_SELECTION 은 AAOS 표준 프로퍼티명 (Pleos 문서엔 Virtual Console 「Gear Selection」 카드로 표기)
 *
 * 프로퍼티 ID·VehicleGear 값은 AAOS 공개 정의(android.car.VehiclePropertyIds / VehicleGear)와 같다.
 */

export const VehiclePropertyIds = {
  /** 0x11400400 */
  GEAR_SELECTION: 289408000,
  /** 0x11600207 — 단위 m/s (float) */
  PERF_VEHICLE_SPEED: 291504647,
} as const;
export type VehiclePropertyId = (typeof VehiclePropertyIds)[keyof typeof VehiclePropertyIds];

/** android.car.VehicleGear */
export const VehicleGear = {
  GEAR_NEUTRAL: 0x0001,
  GEAR_REVERSE: 0x0002,
  GEAR_PARK: 0x0004,
  GEAR_DRIVE: 0x0008,
} as const;

export interface CarPropertyValue<T> {
  propertyId: number;
  areaId: number;
  value: T;
  timestamp: number;
}

export interface CarPropertyEventCallback {
  onChangeEvent(value: CarPropertyValue<number>): void;
  onErrorEvent(propertyId: number, areaId: number): void;
}

export interface CarPropertyManager {
  getProperty(propertyId: VehiclePropertyId, areaId: number): CarPropertyValue<number>;
  registerCallback(callback: CarPropertyEventCallback, propertyId: VehiclePropertyId, updateRateHz: number): boolean;
  unregisterCallback(callback: CarPropertyEventCallback): void;
}

/** android.car.drivingstate.CarUxRestrictions 상수 (S0 1-6에 인용된 것) */
export const UxRestrictions = {
  UX_RESTRICTIONS_BASELINE: 0,
  UX_RESTRICTIONS_LIMIT_STRING_LENGTH: 4,
  UX_RESTRICTIONS_NO_KEYBOARD: 8,
  UX_RESTRICTIONS_NO_VIDEO: 16,
  UX_RESTRICTIONS_NO_SETUP: 64,
} as const;

export interface CarUxRestrictions {
  isRequiresDistractionOptimization(): boolean;
  getActiveRestrictions(): number;
}
export interface CarUxRestrictionsManager {
  registerListener(listener: (restrictions: CarUxRestrictions) => void): void;
  getCurrentCarUxRestrictions(): CarUxRestrictions;
}

export type GearLetter = "P" | "R" | "N" | "D";

export function gearToAaos(g: GearLetter): number {
  switch (g) {
    case "P":
      return VehicleGear.GEAR_PARK;
    case "R":
      return VehicleGear.GEAR_REVERSE;
    case "N":
      return VehicleGear.GEAR_NEUTRAL;
    case "D":
      return VehicleGear.GEAR_DRIVE;
  }
}

export function aaosToGear(v: number): GearLetter {
  if (v === VehicleGear.GEAR_PARK) return "P";
  if (v === VehicleGear.GEAR_REVERSE) return "R";
  if (v === VehicleGear.GEAR_NEUTRAL) return "N";
  return "D";
}

export const kmhToMs = (kmh: number) => kmh / 3.6;
export const msToKmh = (ms: number) => ms * 3.6;
