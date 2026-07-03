/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type BatteryStatusValue,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface CadenceSensorState extends SensorState {
  readonly cadenceEventTime?: number;
  readonly cumulativeCadenceRevolutionCount?: number;
  readonly calculatedCadence?: number;
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

export interface CadenceScanState extends CadenceSensorState, ScanState {}

const TOGGLE_MASK = 0x80;

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one bike cadence broadcast page. Pure: returns the next
 * state instead of mutating it.
 */
export function decodeCadence<TState extends CadenceSensorState>(
  state: Readonly<TState>,
  data: DataView,
): TState {
  const updates: Draft<CadenceSensorState> = {};
  const pageNum = data.getUint8(BUFFER_INDEX_MSG_DATA);

  switch (pageNum & ~TOGGLE_MASK) {
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

  // The default cadence data (last four bytes of every page).
  const oldCadenceTime = state.cadenceEventTime;
  const oldCadenceCount = state.cumulativeCadenceRevolutionCount;

  let cadenceTime = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
  let cadenceCount = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);

  if (cadenceTime !== oldCadenceTime) {
    updates.cadenceEventTime = cadenceTime;
    updates.cumulativeCadenceRevolutionCount = cadenceCount;

    if (oldCadenceTime && oldCadenceTime > cadenceTime) {
      // Hit rollover value.
      cadenceTime += 1024 * 64;
    }

    if (oldCadenceCount && oldCadenceCount > cadenceCount) {
      // Hit rollover value.
      cadenceCount += 1024 * 64;
    }

    const cadence =
      (60 * (cadenceCount - (oldCadenceCount || 0)) * 1024) /
      (cadenceTime - (oldCadenceTime || 0));
    if (!Number.isNaN(cadence)) {
      updates.calculatedCadence = cadence;
    }
  }

  updates.receivedAt = Date.now();

  return { ...state, ...updates } as TState;
}

export class CadenceSensor extends AntPlusSensor<CadenceSensorState> {
  static readonly deviceType = 0x7a;

  protected readonly deviceType = CadenceSensor.deviceType;
  protected readonly period = 8086;

  protected createState(deviceId: number): CadenceSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<CadenceSensorState>,
    data: DataView,
  ): CadenceSensorState {
    return decodeCadence(state, data);
  }
}

export class CadenceScanner extends AntPlusScanner<CadenceScanState> {
  static readonly deviceType = 0x7a;

  protected readonly deviceType = CadenceScanner.deviceType;

  protected createState(deviceId: number): CadenceScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<CadenceScanState>,
    data: DataView,
  ): CadenceScanState {
    return decodeCadence(state, data);
  }
}
