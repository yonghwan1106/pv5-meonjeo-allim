/** Pleos Vehicle SDK 모의 — Door / EvBattery / Seat / Odometer / CarInfo (조회·구독만) */
import type {
  CarInfo,
  Door,
  DoorLockListener,
  DoorPositionCapability,
  DoorPositionListener,
  DoorValue,
  EvBattery,
  OnComplete,
  OnFailed,
  Odometer,
  Seat,
  SeatOccupancyListener,
  SeatValue,
  SocListener,
  Vehicle,
  DoorPositionValue,
  DoorLockValue,
  SeatOccupancyValue,
} from "../vehicle";
import type { MockHub } from "./hub";

const ALL_DOORS: DoorValue[] = ["ROW_1_LEFT", "ROW_1_RIGHT", "ROW_2_RIGHT", "REAR"];

class MockDoor implements Door {
  private posListeners: { area: DoorValue; l: DoorPositionListener }[] = [];
  private lockListeners: { area: DoorValue; l: DoorLockListener }[] = [];
  constructor(private hub: MockHub) {}

  checkDoorPositionCapabilities(onComplete: OnComplete<DoorPositionCapability>, _onFailed: OnFailed): void {
    this.hub.log("VEHICLE", "Door.checkDoorPositionCapabilities", "supported, range 0..1, 쓰기 = 준비 중");
    onComplete({ supported: true, areas: ALL_DOORS, range: [0, 1], writable: false });
  }
  getCurrentDoorPosition(area: DoorValue, onComplete: OnComplete<DoorPositionValue>, _onFailed: OnFailed): void {
    const v = this.hub.world().doors[area];
    this.hub.log("VEHICLE", `Door.getCurrentDoorPosition(${area})`, doorText(v));
    onComplete(v);
  }
  registerDoorPosition(area: DoorValue, listener: DoorPositionListener): void {
    this.posListeners.push({ area, l: listener });
    this.hub.log("VEHICLE", `Door.registerDoorPosition(${area})`);
  }
  unregisterDoorPosition(area: DoorValue, listener: DoorPositionListener): void {
    this.posListeners = this.posListeners.filter((x) => !(x.area === area && x.l === listener));
  }
  getDoorLockState(area: DoorValue, onComplete: OnComplete<DoorLockValue>, _onFailed: OnFailed): void {
    const v: DoorLockValue = this.hub.world().locked ? "LOCKED" : "UNLOCKED";
    this.hub.log("VEHICLE", `Door.getDoorLockState(${area})`, v);
    onComplete(v);
  }
  registerDoorLockState(area: DoorValue, listener: DoorLockListener): void {
    this.lockListeners.push({ area, l: listener });
    this.hub.log("VEHICLE", `Door.registerDoorLockState(${area})`);
  }
  unregisterDoorLockState(area: DoorValue, listener: DoorLockListener): void {
    this.lockListeners = this.lockListeners.filter((x) => !(x.area === area && x.l === listener));
  }
  // setDoorPosition / setDoorLock — @status preparing: 구현하지 않음

  simDoorChanged(area: DoorValue): void {
    const v = this.hub.world().doors[area];
    this.hub.log("VEHICLE", `registerDoorPosition 알림 ← ${area}`, doorText(v) + (area === "REAR" ? " · 카고 뒷문 매핑 [가정]" : ""));
    for (const x of this.posListeners.filter((p) => p.area === area)) x.l(area, v);
  }
  simLockChanged(): void {
    const v: DoorLockValue = this.hub.world().locked ? "LOCKED" : "UNLOCKED";
    this.hub.log("VEHICLE", "registerDoorLockState 알림", v);
    for (const x of this.lockListeners) x.l(x.area, v);
  }
}

class MockEvBattery implements EvBattery {
  private listeners: SocListener[] = [];
  constructor(private hub: MockHub) {}
  getEvBatteryStateOfCharge(onComplete: OnComplete<number>, _onFailed: OnFailed): void {
    const v = this.hub.world().soc;
    this.hub.log("VEHICLE", "EvBattery.getEvBatteryStateOfCharge", `${v.toFixed(0)}%`);
    onComplete(v);
  }
  registerEvBatteryStateOfCharge(listener: SocListener): void {
    this.listeners.push(listener);
    this.hub.log("VEHICLE", "EvBattery.registerEvBatteryStateOfCharge");
  }
  unregisterEvBatteryStateOfCharge(listener: SocListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  simSocChanged(quiet = false): void {
    const v = this.hub.world().soc;
    if (!quiet) this.hub.log("VEHICLE", "registerEvBatteryStateOfCharge 알림", `${v.toFixed(0)}%`);
    for (const l of this.listeners) l(v);
  }
}

class MockSeat implements Seat {
  private listeners: { area: SeatValue; l: SeatOccupancyListener }[] = [];
  constructor(private hub: MockHub) {}
  getCurrentSeatOccupancy(area: SeatValue, onComplete: OnComplete<SeatOccupancyValue>, _onFailed: OnFailed): void {
    onComplete(area === "ROW_1_LEFT" ? this.hub.world().seatDriver : "EMPTY");
  }
  registerSeatOccupancy(area: SeatValue, listener: SeatOccupancyListener): void {
    this.listeners.push({ area, l: listener });
    this.hub.log("VEHICLE", `Seat.registerSeatOccupancy(${area})`);
  }
  unregisterSeatOccupancy(area: SeatValue, listener: SeatOccupancyListener): void {
    this.listeners = this.listeners.filter((x) => !(x.area === area && x.l === listener));
  }
  simSeatChanged(): void {
    const v = this.hub.world().seatDriver;
    this.hub.log("VEHICLE", "registerSeatOccupancy 알림 ← ROW_1_LEFT", v);
    for (const x of this.listeners.filter((p) => p.area === "ROW_1_LEFT")) x.l("ROW_1_LEFT", v);
  }
}

class MockOdometer implements Odometer {
  constructor(private hub: MockHub) {}
  getCurrentDistanceDriven(onComplete: OnComplete<number>, _onFailed: OnFailed): void {
    const v = this.hub.world().odometerKm;
    this.hub.log("VEHICLE", "Odometer.getCurrentDistanceDriven", `${v.toFixed(1)} km`);
    onComplete(v);
  }
}

class MockCarInfo implements CarInfo {
  constructor(private hub: MockHub) {}
  getVINInfo(onComplete: OnComplete<string>, _onFailed: OnFailed): void {
    this.hub.log("VEHICLE", "CarInfo.getVINInfo", "가상 차대번호 (서버가 차종·전고 매칭 [가정])");
    onComplete("VIRTUAL-PV5-CARGO-L-0012");
  }
}

export class MockVehicle implements Vehicle {
  readonly door: MockDoor;
  readonly evBattery: MockEvBattery;
  readonly seat: MockSeat;
  private odometer: MockOdometer;
  private carInfo: MockCarInfo;
  constructor(private hub: MockHub) {
    this.door = new MockDoor(hub);
    this.evBattery = new MockEvBattery(hub);
    this.seat = new MockSeat(hub);
    this.odometer = new MockOdometer(hub);
    this.carInfo = new MockCarInfo(hub);
  }
  initialize(): void {
    this.hub.log("VEHICLE", "Vehicle.initialize()", "Vehicle Service 연결 (모의)");
  }
  release(): void {
    this.hub.log("VEHICLE", "Vehicle.release()");
  }
  getDoor(): Door {
    return this.door;
  }
  getEvBattery(): EvBattery {
    return this.evBattery;
  }
  getSeat(): Seat {
    return this.seat;
  }
  getOdometer(): Odometer {
    return this.odometer;
  }
  getCarInfo(): CarInfo {
    return this.carInfo;
  }
}

function doorText(v: DoorPositionValue): string {
  return v === 1 ? "1 (Open)" : "0 (Closed)";
}
