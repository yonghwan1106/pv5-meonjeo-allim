/**
 * 주행 상태 3단 판정 + 터치 허용 규칙.
 *
 * 근거: 도로교통법 제49조 제1항 제10호(운전 중 휴대용 전화 사용 금지)·제11의2호(운전 중 영상표시장치 조작 금지),
 * AAOS CarUxRestrictions (Distraction Optimization 미선언 앱은 주행 중 사용 불가).
 * 국내법이 AAOS 「그외 지역」 기준보다 엄격하므로, 이 앱은 기어 P(정차·주차)에서만 터치를 받는다.
 */
import type { GearLetter } from "../pleos/carProperty";
import { UxRestrictions } from "../pleos/carProperty";

export type DriveMode = "DRIVING" | "STOPPED" | "PARKED";

export function deriveDriveMode(gear: GearLetter, speedKmh: number): DriveMode {
  if (speedKmh > 0) return "DRIVING";
  if (gear === "P") return "PARKED";
  if (gear === "R") return "DRIVING"; // 후진 조작 중은 주행으로 본다
  return "STOPPED"; // D·N + 차속 0 (신호 대기 등)
}

/** 터치 입력 허용: 기어 P이고 차속 0일 때만 */
export function isTouchAllowed(gear: GearLetter, speedKmh: number): boolean {
  return deriveDriveMode(gear, speedKmh) === "PARKED";
}

/** CarUxRestrictions.getActiveRestrictions() 흉내 */
export function activeUxRestrictions(mode: DriveMode): number {
  if (mode === "PARKED") return UxRestrictions.UX_RESTRICTIONS_BASELINE;
  return (
    UxRestrictions.UX_RESTRICTIONS_NO_KEYBOARD |
    UxRestrictions.UX_RESTRICTIONS_NO_VIDEO |
    UxRestrictions.UX_RESTRICTIONS_LIMIT_STRING_LENGTH |
    UxRestrictions.UX_RESTRICTIONS_NO_SETUP
  );
}

/** 화면 밀도 — 주행 = 큰 글자 2줄 + 칩 1개, 정지 = + 받은 답장 1줄, 주차 = 전체 */
export function screenBudget(mode: DriveMode): { maxLines: number; showReplyLine: boolean; showFullList: boolean } {
  switch (mode) {
    case "DRIVING":
      return { maxLines: 2, showReplyLine: false, showFullList: false };
    case "STOPPED":
      return { maxLines: 3, showReplyLine: true, showFullList: false };
    case "PARKED":
      return { maxLines: 99, showReplyLine: true, showFullList: true };
  }
}

export const DRIVE_MODE_LABEL: Record<DriveMode, string> = {
  DRIVING: "주행 중",
  STOPPED: "정지 (신호 대기)",
  PARKED: "주차 (P)",
};
