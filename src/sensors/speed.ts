/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type BatteryStatusValue,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface SpeedSensorState extends SensorState {
  readonly speedEventTime?: number;
  readonly cumulativeSpeedRevolutionCount?: number;
  readonly calculatedDistance?: number;
  readonly calculatedSpeed?: number;
  readonly operatingTime?: number;
  readonly manId?: number;
  readonly serialNumber?: number;
  readonly hwVersion?: number;
  readonly swVersion?: number;
  readonly modelNum?: number;
  readonly batteryVoltage?: number;
  readonly batteryStatus?: BatteryStatusValue;
  readonly motion?: boolean;
  readonly receivedAt?: number;
}

export interface SpeedScanState extends SpeedSensorState, ScanState {}

const TOGGLE_MASK = 0x80;

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one bicycle speed broadcast page. Pure: returns the next
 * state instead of mutating, or undefined when no new speed event has
 * been recorded since the previous state.
 */
export function decodeSpeed<TState extends SpeedSensorState>(
  state: Readonly<TState>,
  data: DataView,
  wheelCircumference: number,
): TState | undefined {
  const updates: Draft<SpeedSensorState> = {};
  const pageNum = data.getUint8(BUFFER_INDEX_MSG_DATA);

  switch (
    pageNum & ~TOGGLE_MASK // check the new pages and remove the toggle bit
  ) {
    case 1: {
      // Cumulative operating time.
      let operatingTime = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      operatingTime |= data.getUint8(BUFFER_INDEX_MSG_DATA + 2) << 8;
      operatingTime |= data.getUint8(BUFFER_INDEX_MSG_DATA + 3) << 16;
      updates.operatingTime = operatingTime * 2;
      break;
    }
    case 2: {
      // Manufacturer id and the 4 byte serial number.
      updates.manId = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      updates.serialNumber =
        (state.deviceId |
          (data.getUint16(BUFFER_INDEX_MSG_DATA + 2, true) << 16)) >>>
        0;
      break;
    }
    case 3:
      // HW version, SW version and model number.
      updates.hwVersion = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      updates.swVersion = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      updates.modelNum = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      break;
    case 4: {
      const batteryFrac = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      const batteryStatus = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      updates.batteryVoltage = (batteryStatus & 0x0f) + batteryFrac / 256;
      const batteryFlags = (batteryStatus & 0x70) >>> 4;
      switch (batteryFlags) {
        case 1:
          updates.batteryStatus = "New";
          break;
        case 2:
          updates.batteryStatus = "Good";
          break;
        case 3:
          updates.batteryStatus = "Ok";
          break;
        case 4:
          updates.batteryStatus = "Low";
          break;
        case 5:
          updates.batteryStatus = "Critical";
          break;
        default:
          updates.batteryVoltage = undefined;
          updates.batteryStatus = "Invalid";
          break;
      }
      break;
    }
    case 5:
      updates.motion =
        (data.getUint8(BUFFER_INDEX_MSG_DATA + 1) & 0x01) === 0x01;
      break;
    default:
      break;
  }

  // Old state for calculating cumulative values.
  const oldSpeedTime = state.speedEventTime;
  const oldSpeedCount = state.cumulativeSpeedRevolutionCount;

  let speedEventTime = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
  let speedRevolutionCount = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);

  if (speedEventTime !== oldSpeedTime) {
    updates.speedEventTime = speedEventTime;
    updates.cumulativeSpeedRevolutionCount = speedRevolutionCount;

    if (oldSpeedTime && oldSpeedTime > speedEventTime) {
      // Hit rollover value.
      speedEventTime += 1024 * 64;
    }

    if (oldSpeedCount && oldSpeedCount > speedRevolutionCount) {
      // Hit rollover value.
      speedRevolutionCount += 1024 * 64;
    }

    const distance =
      wheelCircumference * (speedRevolutionCount - (oldSpeedCount || 0));
    updates.calculatedDistance = distance;

    // Speed in m/sec.
    const speed = (distance * 1024) / (speedEventTime - (oldSpeedTime || 0));
    if (!Number.isNaN(speed)) {
      updates.calculatedSpeed = speed;
      updates.receivedAt = Date.now();
      return { ...state, ...updates } as TState;
    }
  }

  return undefined;
}

export class SpeedSensor extends AntPlusSensor<SpeedSensorState> {
  static readonly deviceType = 0x7b;

  protected readonly deviceType = SpeedSensor.deviceType;
  protected readonly period = 8086;

  wheelCircumference = 2.199; // default 70cm wheel

  protected createState(deviceId: number): SpeedSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<SpeedSensorState>,
    data: DataView,
  ): SpeedSensorState | undefined {
    return decodeSpeed(state, data, this.wheelCircumference);
  }
}

export class SpeedScanner extends AntPlusScanner<SpeedScanState> {
  static readonly deviceType = 0x7b;

  protected readonly deviceType = SpeedScanner.deviceType;

  wheelCircumference = 2.199; // default 70cm wheel

  protected createState(deviceId: number): SpeedScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<SpeedScanState>,
    data: DataView,
  ): SpeedScanState | undefined {
    return decodeSpeed(state, data, this.wheelCircumference);
  }
}
