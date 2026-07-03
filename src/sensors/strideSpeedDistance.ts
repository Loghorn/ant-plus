/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#528_tab
 * Spec sheet: https://www.thisisant.com/resources/stride-based-speed-and-distance-monitor/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface StrideSpeedDistanceSensorState extends SensorState {
  readonly timeFractional?: number;
  readonly timeInteger?: number;
  readonly distanceInteger?: number;
  readonly distanceFractional?: number;
  readonly speedInteger?: number;
  readonly speedFractional?: number;
  readonly strideCount?: number;
  readonly updateLatency?: number;
  readonly cadenceInteger?: number;
  readonly cadenceFractional?: number;
  readonly status?: number;
  readonly calories?: number;
  readonly receivedAt?: number;
}

export interface StrideSpeedDistanceScanState
  extends StrideSpeedDistanceSensorState,
    ScanState {}

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one stride-based speed and distance broadcast page. Pure:
 * returns the next state instead of mutating it.
 */
export function decodeStrideSpeedDistance<
  TState extends StrideSpeedDistanceSensorState,
>(state: Readonly<TState>, data: DataView): TState {
  const updates: Draft<StrideSpeedDistanceSensorState> = {};
  const page = data.getUint8(BUFFER_INDEX_MSG_DATA);

  if (page === 1) {
    updates.timeFractional = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
    updates.timeInteger = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
    updates.distanceInteger = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
    updates.distanceFractional = data.getUint8(BUFFER_INDEX_MSG_DATA + 4) >>> 4;
    updates.speedInteger = data.getUint8(BUFFER_INDEX_MSG_DATA + 4) & 0x0f;
    updates.speedFractional = data.getUint8(BUFFER_INDEX_MSG_DATA + 5);
    updates.strideCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
    updates.updateLatency = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);
  } else if (page >= 2 && page <= 15) {
    updates.cadenceInteger = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
    updates.cadenceFractional = data.getUint8(BUFFER_INDEX_MSG_DATA + 4) >>> 4;
    updates.speedInteger = data.getUint8(BUFFER_INDEX_MSG_DATA + 4) & 0x0f;
    updates.speedFractional = data.getUint8(BUFFER_INDEX_MSG_DATA + 5);
    updates.status = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

    switch (page) {
      case 3:
        updates.calories = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
        break;
      default:
        break;
    }
  }

  updates.receivedAt = Date.now();

  return { ...state, ...updates } as TState;
}

export class StrideSpeedDistanceSensor extends AntPlusSensor<StrideSpeedDistanceSensorState> {
  static readonly deviceType = 124;

  protected readonly deviceType = StrideSpeedDistanceSensor.deviceType;
  protected readonly period = 8134;

  protected createState(deviceId: number): StrideSpeedDistanceSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<StrideSpeedDistanceSensorState>,
    data: DataView,
  ): StrideSpeedDistanceSensorState {
    return decodeStrideSpeedDistance(state, data);
  }
}

export class StrideSpeedDistanceScanner extends AntPlusScanner<StrideSpeedDistanceScanState> {
  static readonly deviceType = 124;

  protected readonly deviceType = StrideSpeedDistanceScanner.deviceType;

  protected createState(deviceId: number): StrideSpeedDistanceScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<StrideSpeedDistanceScanState>,
    data: DataView,
  ): StrideSpeedDistanceScanState {
    return decodeStrideSpeedDistance(state, data);
  }
}
