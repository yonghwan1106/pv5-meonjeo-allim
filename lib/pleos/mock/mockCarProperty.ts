/** AAOS CarPropertyManager 모의 — GEAR_SELECTION·PERF_VEHICLE_SPEED */
import {
  VehiclePropertyIds,
  aaosToGear,
  gearToAaos,
  kmhToMs,
  type CarPropertyEventCallback,
  type CarPropertyManager,
  type CarPropertyValue,
  type VehiclePropertyId,
} from "../carProperty";
import type { MockHub } from "./hub";

const NAME: Record<number, string> = {
  [VehiclePropertyIds.GEAR_SELECTION]: "GEAR_SELECTION",
  [VehiclePropertyIds.PERF_VEHICLE_SPEED]: "PERF_VEHICLE_SPEED",
};

export class MockCarPropertyManager implements CarPropertyManager {
  private callbacks: { cb: CarPropertyEventCallback; prop: number }[] = [];
  constructor(private hub: MockHub) {}

  private read(prop: number): number {
    const w = this.hub.world();
    return prop === VehiclePropertyIds.GEAR_SELECTION ? gearToAaos(w.gear) : kmhToMs(w.speedKmh);
  }

  getProperty(propertyId: VehiclePropertyId, areaId: number): CarPropertyValue<number> {
    const value = this.read(propertyId);
    this.hub.log("AAOS", `CarPropertyManager.getProperty(${NAME[propertyId]})`, describe(propertyId, value));
    return { propertyId, areaId, value, timestamp: this.hub.nowSec() * 1000 };
  }

  registerCallback(callback: CarPropertyEventCallback, propertyId: VehiclePropertyId, updateRateHz: number): boolean {
    this.callbacks.push({ cb: callback, prop: propertyId });
    this.hub.log("AAOS", `CarPropertyManager.registerCallback(${NAME[propertyId]}, ${updateRateHz}Hz)`);
    return true;
  }

  unregisterCallback(callback: CarPropertyEventCallback): void {
    this.callbacks = this.callbacks.filter((c) => c.cb !== callback);
  }

  /** 시뮬레이터 전용 — 값이 바뀌었음을 알린다 */
  simEmit(propertyId: VehiclePropertyId, quiet = false): void {
    const value = this.read(propertyId);
    if (!quiet) this.hub.log("AAOS", `onChangeEvent(${NAME[propertyId]})`, describe(propertyId, value));
    const ev: CarPropertyValue<number> = { propertyId, areaId: 0, value, timestamp: this.hub.nowSec() * 1000 };
    for (const c of this.callbacks.filter((x) => x.prop === propertyId)) c.cb.onChangeEvent(ev);
  }
}

function describe(prop: number, value: number): string {
  if (prop === VehiclePropertyIds.GEAR_SELECTION) return `GEAR_${aaosToGear(value)} (${value})`;
  return `${value.toFixed(1)} m/s (${Math.round(value * 3.6)} km/h)`;
}
