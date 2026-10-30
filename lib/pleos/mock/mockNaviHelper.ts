/**
 * NaviHelper 모의 — 자체 시간표(data/day.json)로 경로·ETA·남은 거리를 계산한다. 지도 API 없음.
 * 실제 SDK에서는 Pleos Connect Navigation 앱이 이 값을 계산해 이벤트로 준다.
 */
import { epochMsToMin, minToEpochMs } from "../../engine/clock";
import type { Leg } from "../../engine/types";
import { fmtHHMM } from "../../logic/time";
import { distanceForBaseMin, getNode, hourFactor, nodeLatLng, travelBaseMin, travelFromLegBase } from "../../logic/travel";
import {
  MAX_WAYPOINTS,
  type DestinationInfo,
  type NaviHelper,
  type NaviHelperEventListener,
  type RouteInfo,
  type TripInfo,
  type WaypointIndex,
} from "../naviHelper";
import type { MockHub } from "./hub";

/** kWh/km [가정] — 71.2kWh 배터리 기준 1km ≈ 0.28% */
export const KWH_PER_KM = 0.2;
export const SOC_PCT_PER_KM = (KWH_PER_KM / 71.2) * 100;
const EMIT_EVERY_SEC = 15;

export class MockNaviHelper implements NaviHelper {
  private listeners: NaviHelperEventListener[] = [];
  private waypoints: RouteInfo[] = [];
  constructor(
    private hub: MockHub,
    private hooks: { stopVehicle(): void },
  ) {}

  private each(fn: (l: NaviHelperEventListener) => void) {
    for (const l of [...this.listeners]) fn(l);
  }

  initialize(): void {
    this.hub.log("NAVI", "NaviHelper.initialize()", "Navi Service 연결 (모의)");
  }
  release(): void {
    this.hub.log("NAVI", "NaviHelper.release()");
  }
  addListener(listener: NaviHelperEventListener): void {
    this.listeners.push(listener);
    this.hub.log("NAVI", "NaviHelper.addListener(NaviHelperEventListener)");
  }
  removeListener(listener: NaviHelperEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  requestRoute(route: RouteInfo): void {
    this.hub.log("NAVI", "NaviHelper.requestRoute(RouteInfo)", `poiName=${route.poiName}`);
    const target = route.poiId;
    try {
      getNode(target);
    } catch {
      this.hub.log("NAVI", "onError", "INVALID_PARAM");
      this.each((l) => l.onError?.("INVALID_PARAM"));
      return;
    }
    const w = this.hub.world();
    w.leg = buildLeg(w.leg, w.at, target, route.poiName, this.hub.nowSec() / 60);
    w.lastLoggedEta = null;
    w.tripEmitAccum = 0;
    this.hub.log("NAVI", "onRouteStarted(RouteStartInfo)", route.poiName);
    this.each((l) => l.onRouteStarted?.({ poiName: route.poiName }));
    this.each((l) => l.onDestinationChanged?.());
    this.hub.log("NAVI", "onRoutingCompleted()", "경로 탐색 완료 — requestRoute 반환 ≠ 완료, 콜백으로 확인(원문)");
    this.each((l) => l.onRoutingCompleted?.());
    this.emitTrip(true);
  }

  getDestinationInfo(): void {
    const d = this.destinationInfo();
    this.hub.log("NAVI", "NaviHelper.getDestinationInfo()", d ? `→ onDestinationInfo ${(d.remainDistance / 1000).toFixed(1)}km` : "목적지 없음");
    if (d) this.each((l) => l.onDestinationInfo?.(d));
  }

  cancelRoute(): void {
    this.hub.world().leg = null;
    this.hub.log("NAVI", "NaviHelper.cancelRoute()");
    this.each((l) => l.onRouteCancelled?.());
    this.each((l) => l.onDestinationChanged?.());
  }

  addWaypoint(index: WaypointIndex, route: RouteInfo): void {
    if (this.waypoints.length >= MAX_WAYPOINTS) {
      this.hub.log("NAVI", `addWaypoint(${index}) 거부`, `경유지 최대 ${MAX_WAYPOINTS}개`);
      this.each((l) => l.onError?.("INVALID_PARAM"));
      return;
    }
    this.waypoints.push(route);
    this.hub.log("NAVI", `NaviHelper.addWaypoint(${index})`, route.poiName);
    this.each((l) => l.onWaypointChanged?.());
  }
  removeWaypoint(index: WaypointIndex): void {
    this.waypoints.splice(index === "FIRST" ? 0 : 1, 1);
    this.hub.log("NAVI", `NaviHelper.removeWaypoint(${index})`);
    this.each((l) => l.onWaypointChanged?.());
  }
  getWaypointInfo(): void {
    this.hub.log("NAVI", "NaviHelper.getWaypointInfo()", `${this.waypoints.length}개`);
  }
  requestRouteWithWaypoints(destination: RouteInfo, waypoints: RouteInfo[]): void {
    if (waypoints.length > MAX_WAYPOINTS) {
      this.hub.log("NAVI", "requestRouteWithWaypoints 거부", `경유지 ${waypoints.length}개 > 최대 ${MAX_WAYPOINTS}개`);
      this.each((l) => l.onError?.("INVALID_PARAM"));
      return;
    }
    this.waypoints = [...waypoints];
    this.requestRoute(destination);
  }
  getCurrentLocationInfo(): void {
    const w = this.hub.world();
    const node = w.leg ? w.leg.to : w.at;
    const ll = nodeLatLng(node);
    this.hub.log("NAVI", "NaviHelper.getCurrentLocationInfo()", "가상 좌표 (고객에게 보내지 않음)");
    this.each((l) => l.onCurrentLocationInfo?.({ latitude: ll.lat, longitude: ll.lng, heading: 0, address: "가상 위치" }));
  }
  requestNavigationScreen(): void {
    this.hub.log("NAVI", "NaviHelper.requestNavigationScreen()");
  }

  // ------------------------------------------------------------------ 계산값
  remain(): { remainBaseSec: number; remainTimeSec: number; remainDistM: number } | null {
    const leg = this.hub.world().leg;
    if (!leg) return null;
    const remainBaseSec = Math.max(0, leg.totalBaseSec - leg.progressBaseSec);
    return {
      remainBaseSec,
      remainTimeSec: remainBaseSec * leg.factor,
      remainDistM: leg.totalBaseSec > 0 ? (leg.totalDistM * remainBaseSec) / leg.totalBaseSec : 0,
    };
  }

  destinationInfo(): DestinationInfo | null {
    const leg = this.hub.world().leg;
    const r = this.remain();
    if (!leg || !r) return null;
    return {
      poiName: leg.poiName,
      address: getNode(leg.to).address,
      remainDistance: Math.round(r.remainDistM),
      remainTime: Math.round(r.remainTimeSec),
      tollFare: 0,
    };
  }

  tripInfo(): TripInfo | null {
    const leg = this.hub.world().leg;
    const r = this.remain();
    if (!leg || !r) return null;
    const soc = this.hub.world().soc;
    const remainKm = r.remainDistM / 1000;
    return {
      eta: minToEpochMs(this.hub.nowSec() / 60 + r.remainTimeSec / 60),
      distance: Math.round(leg.totalDistM),
      energyConsumption: +((leg.totalDistM / 1000) * KWH_PER_KM).toFixed(2),
      estimatedSocAtDest: Math.max(0, Math.round(soc - remainKm * SOC_PCT_PER_KM)),
    };
  }

  emitTrip(force = false): void {
    const leg = this.hub.world().leg;
    if (!leg || leg.arrived) return;
    const t = this.tripInfo();
    const d = this.destinationInfo();
    if (!t || !d) return;
    const w = this.hub.world();
    const etaMin = Math.floor(epochMsToMin(t.eta));
    if (force || w.lastLoggedEta === null || Math.abs(etaMin - w.lastLoggedEta) >= 1) {
      this.hub.log(
        "NAVI",
        "onTripInfo(TripInfo) · onDestinationInfo",
        `eta=${fmtHHMM(etaMin)} remainTime=${Math.round(d.remainTime / 60)}분 remainDistance=${(d.remainDistance / 1000).toFixed(1)}km estimatedSocAtDest=${t.estimatedSocAtDest}%`,
      );
      w.lastLoggedEta = etaMin;
    }
    this.each((l) => l.onTripInfo?.(t));
    this.each((l) => l.onDestinationInfo?.(d));
  }

  // ------------------------------------------------------------------ 시뮬레이터 전용
  simTick(dtSec: number): void {
    const w = this.hub.world();
    const leg = w.leg;
    if (!leg || leg.arrived) return;
    const driving = w.speedKmh > 0 && w.gear === "D";
    if (driving) {
      leg.progressBaseSec = Math.min(leg.totalBaseSec, leg.progressBaseSec + dtSec / leg.factor);
      if (leg.progressBaseSec >= leg.totalBaseSec - 1e-6) {
        this.arrive();
        return;
      }
    }
    w.tripEmitAccum += dtSec;
    if (w.tripEmitAccum >= EMIT_EVERY_SEC) {
      w.tripEmitAccum = 0;
      this.emitTrip();
    }
  }

  simCongestion(addMin: number): void {
    const leg = this.hub.world().leg;
    if (!leg || leg.arrived) {
      this.hub.log("SIM", "정체 추가 무시", "진행 중인 경로 없음");
      return;
    }
    const remainBase = leg.totalBaseSec - leg.progressBaseSec;
    if (remainBase < 30) return;
    const remainTime = remainBase * leg.factor;
    leg.factor = (remainTime + addMin * 60) / remainBase;
    this.hub.log("SIM", `정체 +${addMin}분`, `정체 계수 ×${leg.factor.toFixed(2)}`);
    this.emitTrip(true);
  }

  simClearCongestion(): void {
    const leg = this.hub.world().leg;
    if (!leg) return;
    leg.factor = 1;
    this.hub.log("SIM", "정체 해소");
    this.emitTrip(true);
  }

  simRemainKm(km: number): void {
    const leg = this.hub.world().leg;
    if (!leg || leg.arrived) {
      this.hub.log("SIM", "남은 거리 설정 무시", "진행 중인 경로 없음");
      return;
    }
    const ratio = Math.min(1, (km * 1000) / Math.max(1, leg.totalDistM));
    leg.progressBaseSec = Math.max(leg.progressBaseSec, leg.totalBaseSec * (1 - ratio));
    this.hub.log("SIM", `남은 거리 ${km}km로 이동`);
    this.emitTrip(true);
  }

  simProgress(pct: number): void {
    const leg = this.hub.world().leg;
    if (!leg || leg.arrived) return;
    leg.progressBaseSec = Math.min(leg.totalBaseSec * 0.999, (leg.totalBaseSec * pct) / 100);
    this.emitTrip(true);
  }

  simArrive(): void {
    const leg = this.hub.world().leg;
    if (!leg || leg.arrived) {
      this.hub.log("SIM", "목적지 도착 무시", "진행 중인 경로 없음");
      return;
    }
    leg.progressBaseSec = leg.totalBaseSec;
    this.arrive();
  }

  private arrive(): void {
    const w = this.hub.world();
    const leg = w.leg;
    if (!leg) return;
    leg.arrived = true;
    w.at = leg.to;
    this.hooks.stopVehicle();
    this.hub.log("NAVI", "onDestinationArrived()", leg.poiName);
    this.each((l) => l.onDestinationArrived?.());
  }
}

/** 지금 위치(진행 중 구간 위 또는 정차 지점)에서 target까지의 새 구간 */
export function buildLeg(prev: Leg | null, at: string, target: string, poiName: string, nowMin: number): Leg {
  const hf = hourFactor(nowMin);
  let from: string;
  let totalBaseMin: number;
  let remainBaseMin: number;
  if (prev && !prev.arrived) {
    const p = prev.totalBaseSec > 0 ? prev.progressBaseSec / prev.totalBaseSec : 0;
    from = prev.from;
    remainBaseMin = travelFromLegBase(prev.from, prev.to, p, target);
    totalBaseMin = Math.max(travelBaseMin(from, target), remainBaseMin);
  } else {
    from = at;
    totalBaseMin = travelBaseMin(from, target);
    remainBaseMin = totalBaseMin;
  }
  totalBaseMin = Math.max(totalBaseMin, 0.5);
  remainBaseMin = Math.min(Math.max(remainBaseMin, 0.5), totalBaseMin);
  return {
    from,
    to: target,
    poiName,
    totalBaseSec: totalBaseMin * 60 * hf,
    totalDistM: distanceForBaseMin(totalBaseMin),
    progressBaseSec: (totalBaseMin - remainBaseMin) * 60 * hf,
    factor: 1,
    arrived: false,
  };
}
