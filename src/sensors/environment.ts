/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#528_tab
 * Spec sheet: https://www.thisisant.com/resources/environment/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface EnvironmentSensorState extends SensorState {
  readonly eventCount?: number;
  readonly temperature?: number;
  readonly receivedAt?: number;
}

export interface EnvironmentScanState
  extends EnvironmentSensorState,
    ScanState {}

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one environment broadcast page. Pure: returns the next state
 * instead of mutating it.
 */
export function decodeEnvironment<TState extends EnvironmentSensorState>(
  state: Readonly<TState>,
  data: DataView,
): TState {
  const updates: Draft<EnvironmentSensorState> = {};
  const page = data.getUint8(BUFFER_INDEX_MSG_DATA);

  if (page === 1) {
    updates.eventCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
    updates.temperature = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true) / 100;
  }

  updates.receivedAt = Date.now();

  return { ...state, ...updates } as TState;
}

export class EnvironmentSensor extends AntPlusSensor<EnvironmentSensorState> {
  static readonly deviceType = 25;

  protected readonly deviceType = EnvironmentSensor.deviceType;
  protected readonly period = 8192;

  protected createState(deviceId: number): EnvironmentSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<EnvironmentSensorState>,
    data: DataView,
  ): EnvironmentSensorState {
    return decodeEnvironment(state, data);
  }
}

export class EnvironmentScanner extends AntPlusScanner<EnvironmentScanState> {
  static readonly deviceType = 25;

  protected readonly deviceType = EnvironmentScanner.deviceType;

  protected createState(deviceId: number): EnvironmentScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<EnvironmentScanState>,
    data: DataView,
  ): EnvironmentScanState {
    return decodeEnvironment(state, data);
  }
}
