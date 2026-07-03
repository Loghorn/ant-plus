/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface SpeedCadenceSensorState extends SensorState {
  readonly cadenceEventTime?: number;
  readonly cumulativeCadenceRevolutionCount?: number;
  readonly speedEventTime?: number;
  readonly cumulativeSpeedRevolutionCount?: number;
  readonly calculatedCadence?: number;
  readonly calculatedDistance?: number;
  readonly calculatedSpeed?: number;
  readonly receivedAt?: number;
}

export interface SpeedCadenceScanState
  extends SpeedCadenceSensorState,
    ScanState {}

const DEFAULT_WHEEL_CIRCUMFERENCE = 2.199; // default 70cm wheel

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one combined speed & cadence broadcast page. Pure: returns
 * the next state, or undefined when neither the cadence nor the speed
 * data changed.
 */
export function decodeSpeedCadence<TState extends SpeedCadenceSensorState>(
  state: Readonly<TState>,
  data: DataView,
  wheelCircumference: number,
): TState | undefined {
  const updates: Draft<SpeedCadenceSensorState> = {};

  // get old state for calculating cumulative values
  const oldCadenceTime = state.cadenceEventTime;
  const oldCadenceCount = state.cumulativeCadenceRevolutionCount;
  const oldSpeedTime = state.speedEventTime;
  const oldSpeedCount = state.cumulativeSpeedRevolutionCount;

  let cadenceTime = data.getUint16(BUFFER_INDEX_MSG_DATA, false);
  let cadenceCount = data.getUint16(BUFFER_INDEX_MSG_DATA + 2, true);
  let speedEventTime = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
  let speedRevolutionCount = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);

  let cadenceDataChanged = false;
  let speedDataChanged = false;

  if (cadenceTime !== oldCadenceTime) {
    updates.cadenceEventTime = cadenceTime;
    updates.cumulativeCadenceRevolutionCount = cadenceCount;

    if (oldCadenceTime && oldCadenceTime > cadenceTime) {
      // Hit rollover value
      cadenceTime += 1024 * 64;
    }

    if (oldCadenceCount && oldCadenceCount > cadenceCount) {
      // Hit rollover value
      cadenceCount += 1024 * 64;
    }

    const cadence =
      (60 * (cadenceCount - (oldCadenceCount || 0)) * 1024) /
      (cadenceTime - (oldCadenceTime || 0));
    if (!Number.isNaN(cadence)) {
      updates.calculatedCadence = cadence;
      cadenceDataChanged = true;
    }
  }

  if (speedEventTime !== oldSpeedTime) {
    updates.speedEventTime = speedEventTime;
    updates.cumulativeSpeedRevolutionCount = speedRevolutionCount;

    if (oldSpeedTime && oldSpeedTime > speedEventTime) {
      // Hit rollover value
      speedEventTime += 1024 * 64;
    }

    if (oldSpeedCount && oldSpeedCount > speedRevolutionCount) {
      // Hit rollover value
      speedRevolutionCount += 1024 * 64;
    }

    const distance =
      wheelCircumference * (speedRevolutionCount - (oldSpeedCount || 0));
    updates.calculatedDistance = distance;

    // speed in m/sec
    const speed = (distance * 1024) / (speedEventTime - (oldSpeedTime || 0));
    if (!Number.isNaN(speed)) {
      updates.calculatedSpeed = speed;
      speedDataChanged = true;
    }
  }

  if (!cadenceDataChanged && !speedDataChanged) {
    return undefined;
  }

  updates.receivedAt = Date.now();

  return { ...state, ...updates } as TState;
}

export class SpeedCadenceSensor extends AntPlusSensor<SpeedCadenceSensorState> {
  static readonly deviceType = 0x79;

  protected readonly deviceType = SpeedCadenceSensor.deviceType;
  protected readonly period = 8086;

  wheelCircumference = DEFAULT_WHEEL_CIRCUMFERENCE;

  protected createState(deviceId: number): SpeedCadenceSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<SpeedCadenceSensorState>,
    data: DataView,
  ): SpeedCadenceSensorState | undefined {
    return decodeSpeedCadence(state, data, this.wheelCircumference);
  }
}

export class SpeedCadenceScanner extends AntPlusScanner<SpeedCadenceScanState> {
  static readonly deviceType = 0x79;

  protected readonly deviceType = SpeedCadenceScanner.deviceType;

  wheelCircumference = DEFAULT_WHEEL_CIRCUMFERENCE;

  protected createState(deviceId: number): SpeedCadenceScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<SpeedCadenceScanState>,
    data: DataView,
  ): SpeedCadenceScanState | undefined {
    return decodeSpeedCadence(state, data, this.wheelCircumference);
  }
}
