/** 웹 모의 어댑터 ↔ Pleos SDK 원문 API ↔ 권한 대응표 (/sdk 화면과 docs/PLEOS_PORTING.md 공용) */

/** 「가이드 공개」 = 문서(가이드)는 공개됐지만 create-my-project의 「신청 없이 바로 사용 가능」 목록(Vehicle State·NaviHelper)에는 없음 — 등록 절차 확인 필요 */
export type SdkStatus = "사용 가능" | "가이드 공개" | "준비 중" | "AAOS 표준" | "가정";

export interface MappingRow {
  feature: string;
  web: string;
  pleos: string;
  permission: string;
  status: SdkStatus;
}

export const MAPPING: MappingRow[] = [
  { feature: "기어 P/R/N/D", web: "MockCarPropertyManager · GEAR_SELECTION", pleos: "CarPropertyManager.registerCallback(GEAR_SELECTION)", permission: "AAOS 표준 권한 (android.car.permission.*) — 이식 시 확인", status: "AAOS 표준" },
  { feature: "차속", web: "MockCarPropertyManager · PERF_VEHICLE_SPEED", pleos: "CarPropertyManager.registerCallback(PERF_VEHICLE_SPEED) — Pleos FAQ 원문", permission: "AAOS 표준 권한 — 이식 시 확인", status: "AAOS 표준" },
  { feature: "카고 뒷문 열림 = 작업 시작", web: "MockVehicle.door.registerDoorPosition(REAR)", pleos: "Vehicle.getDoor().registerDoorPosition / getCurrentDoorPosition / checkDoorPositionCapabilities", permission: "pleos.car.permission.CAR_DOORS", status: "가정" },
  { feature: "문 잠금 상태", web: "MockVehicle.door.registerDoorLockState", pleos: "Door.getDoorLockState / registerDoorLockState", permission: "pleos.car.permission.CAR_DOORS", status: "사용 가능" },
  { feature: "배터리 SOC", web: "MockVehicle.evBattery.registerEvBatteryStateOfCharge", pleos: "Vehicle.getEvBattery().getEvBatteryStateOfCharge / registerEvBatteryStateOfCharge", permission: "pleos.car.permission.CAR_ENERGY", status: "사용 가능" },
  { feature: "운전석 점유", web: "MockVehicle.seat.registerSeatOccupancy(ROW_1_LEFT)", pleos: "Seat.getCurrentSeatOccupancy / registerSeatOccupancy", permission: "pleos.car.permission.CAR_SEATS", status: "사용 가능" },
  { feature: "이동 거리 기록", web: "MockVehicle.getOdometer().getCurrentDistanceDriven", pleos: "Odometer.getCurrentDistanceDriven", permission: "pleos.car.permission.CAR_DRIVE", status: "사용 가능" },
  { feature: "차종 판별 (전고)", web: "MockVehicle.getCarInfo().getVINInfo", pleos: "CarInfo.getVINInfo", permission: "pleos.car.permission.CAR_INFO", status: "가정" },
  { feature: "다음 고객으로 목적지 설정", web: "MockNaviHelper.requestRoute(RouteInfo)", pleos: "NaviHelper.requestRoute(RouteInfo(latitude, longitude, …, poiName, poiId, poiSubId, address))", permission: "NaviHelper 권한 (Declaring permissions 문서)", status: "사용 가능" },
  { feature: "경로 탐색 완료 확인", web: "onRouteStarted / onRoutingCompleted", pleos: "NaviHelperEventListener.onRouteStarted / onRoutingCompleted / onError", permission: "〃", status: "사용 가능" },
  { feature: "도착 예정 시각", web: "onTripInfo(TripInfo.eta · estimatedSocAtDest)", pleos: "NaviHelperEventListener.onTripInfo(TripInfo)", permission: "〃", status: "사용 가능" },
  { feature: "남은 시간·거리 (10분 전 확인)", web: "onDestinationInfo(remainTime · remainDistance)", pleos: "NaviHelper.getDestinationInfo() → onDestinationInfo(DestinationInfo)", permission: "〃", status: "사용 가능" },
  { feature: "도착 감지", web: "onDestinationArrived()", pleos: "NaviHelperEventListener.onDestinationArrived()", permission: "〃", status: "사용 가능" },
  { feature: "경유지 (최대 2개)", web: "addWaypoint / requestRouteWithWaypoints — 3개 이상 거부", pleos: "NaviHelper.addWaypoint(WaypointIndex.FIRST|SECOND) / requestRouteWithWaypoints", permission: "〃", status: "사용 가능" },
  { feature: "음성 명령 3개", web: "MockGleo · data/gleo-app-schema.json", pleos: "Gleo Interface App Schema (actionCalls ≤ 3) · Intent action · APP_ACTION_RESPONSE 브로드캐스트", permission: "Pleos App Market 등록 시 App Schema 제출 (사용 신청 절차 문서 미확인)", status: "가이드 공개" },
  { feature: "앱이 먼저 묻기", web: "MockGleo.requestProactiveSuggestion", pleos: "Gleo proactive suggestion — 서드파티 공개 여부 문서 미확인 (대체: 알림 카드 + 비프 + 호출어)", permission: "—", status: "가정" },
  { feature: "주행 중 터치 제한", web: "deriveDriveMode + 오버레이", pleos: "CarUxRestrictionsManager.registerListener(onUxRestrictionsChanged) + DO 선언", permission: "AAOS 표준", status: "AAOS 표준" },
  { feature: "운전자 안내 음성", web: "브라우저 speechSynthesis (ko-KR) + 자막", pleos: "TextToSpeech SDK v3.3.1 (HYBRID/SERVER/ON_DEVICE)", permission: "Playground 앱 등록 (서버 모드)", status: "준비 중" },
  { feature: "고객 집 반경 진입", web: "(NaviHelper remainTime으로 대신)", pleos: "FusedLocation.addProximityAlert", permission: "pleos.car.permission.FUSED_LOCATION", status: "준비 중" },
  { feature: "문·공조 제어", web: "쓰지 않음", pleos: "Vehicle Control SDK (setDoorPosition 등)", permission: "CONTROL_CAR_*", status: "준비 중" },
];

export const STATUS_COLOR: Record<SdkStatus, string> = {
  "사용 가능": "var(--ok)",
  "가이드 공개": "#e6d38a",
  "준비 중": "#c8b6ff",
  "AAOS 표준": "#9fd3ff",
  가정: "var(--warn)",
};
