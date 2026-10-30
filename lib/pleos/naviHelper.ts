/**
 * Pleos Connect **NaviHelper SDK v3.0.5** 모양 인터페이스 (웹 시제품용).
 *
 * 원문 근거
 * - NaviHelper/intro: 「NaviHelper 객체 생성 → initialize() → addListener() → 경로 요청·정보 조회 → 콜백 처리 →
 *   removeListener()·release()」, 「실제로 전달되는 이벤트는 Navigation 앱의 구현과 현재 상태에 따라 달라질 수 있습니다」
 * - NaviHelper/destinations: requestRoute(RouteInfo(latitude, longitude, displayLongitude, displayLatitude, poiName,
 *   poiId, poiSubId, address)), getDestinationInfo() → onDestinationInfo, cancelRoute(),
 *   onRouteStarted / onRoutingCompleted / onDestinationChanged / onError,
 *   「requestRoute() 호출이 정상적으로 수행되더라도 경로 탐색 완료를 의미하지 않습니다」
 * - NaviHelper/event-listeners: onDestinationArrived(), onWayPointArrived(), onTripInfo(), onCautionPointInfo() 등
 * - NaviHelper/waypoint-settings: 경유지는 최대 두 개 (WaypointIndex.FIRST / SECOND)
 * - S0 1-3: DestinationInfo.remainDistance·remainTime·tollFare, TripInfo.eta·distance·energyConsumption·estimatedSocAtDest
 *
 * 필드 단위(m·초·epoch ms)는 문서 미확인이라 [가정]이다.
 */

export interface RouteInfo {
  latitude: number;
  longitude: number;
  displayLongitude: number | null;
  displayLatitude: number | null;
  poiName: string;
  poiId: string;
  poiSubId: string;
  address: string;
}

export interface RouteStartInfo {
  poiName: string;
}

export interface DestinationInfo {
  poiName: string;
  address: string;
  /** [가정] 미터 */
  remainDistance: number;
  /** [가정] 초 */
  remainTime: number;
  tollFare: number;
}

export interface TripInfo {
  /** [가정] epoch ms */
  eta: number;
  /** [가정] 미터 */
  distance: number;
  /** [가정] kWh */
  energyConsumption: number;
  /** % */
  estimatedSocAtDest: number;
}

export interface WaypointArrivedInfo {
  name: string;
  address: string;
  distance: number;
  duration: number;
}

export type WaypointIndex = "FIRST" | "SECOND";
/** 「경유지는 최대 두 개까지 지정할 수 있으며, WaypointIndex.FIRST와 WaypointIndex.SECOND로 구분」 */
export const MAX_WAYPOINTS = 2;

export type CautionPointType = "SCHOOL_ZONE" | "NO_PARKING_ZONE" | "BUS_LANE" | "NARROW_ROAD" | "SPEED_BUMP";
export interface CautionPointInfo {
  type: CautionPointType;
  /** [가정] 미터 */
  distance: number;
}

export interface CurrentLocationInfo {
  latitude: number;
  longitude: number;
  heading: number;
  address: string;
}

export type NaviErrorCode = "ROUTE_FAILED" | "NOT_CONNECTED" | "INVALID_PARAM" | "UNKNOWN";

/** 필요한 콜백만 재정의한다 (원문 「필요한 콜백만 재정의하고」). */
export interface NaviHelperEventListener {
  onRouteStarted?(routeStartInfo: RouteStartInfo): void;
  onRoutingCompleted?(): void;
  onRouteCancelled?(): void;
  onDestinationChanged?(): void;
  onDestinationArrived?(): void;
  onWaypointChanged?(): void;
  onWayPointArrived?(info: WaypointArrivedInfo): void;
  onDestinationInfo?(info: DestinationInfo): void;
  onTripInfo?(info: TripInfo): void;
  onCurrentLocationInfo?(info: CurrentLocationInfo): void;
  onCautionPointInfo?(info: CautionPointInfo): void;
  onError?(errorCode: NaviErrorCode): void;
}

export interface NaviHelper {
  initialize(): void;
  release(): void;
  addListener(listener: NaviHelperEventListener): void;
  removeListener(listener: NaviHelperEventListener): void;
  requestRoute(route: RouteInfo): void;
  getDestinationInfo(): void;
  cancelRoute(): void;
  addWaypoint(index: WaypointIndex, route: RouteInfo): void;
  removeWaypoint(index: WaypointIndex): void;
  getWaypointInfo(): void;
  requestRouteWithWaypoints(destination: RouteInfo, waypoints: RouteInfo[]): void;
  getCurrentLocationInfo(): void;
  requestNavigationScreen(): void;
}

/** NaviHelper 권한 이름은 문서 「Declaring permissions」 쪽 원문 확인 후 Manifest에 선언한다 (이 시제품 사본엔 미수집). */
