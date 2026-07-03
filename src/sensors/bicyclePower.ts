/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface BicyclePowerSensorState extends SensorState {
  readonly pedalPower?: number;
  readonly rightPedalPower?: number;
  readonly leftPedalPower?: number;
  readonly cadence?: number;
  readonly accumulatedPower?: number;
  readonly power?: number;
  /** Calibration offset received on page 0x01. Defaults to 0. */
  readonly offset?: number;
  readonly eventCount?: number;
  readonly timeStamp?: number;
  readonly slope?: number;
  readonly torqueTicksStamp?: number;
  readonly calculatedCadence?: number;
  readonly calculatedTorque?: number;
  readonly calculatedPower?: number;
  readonly receivedAt?: number;
}

export interface BicyclePowerScanState
  extends BicyclePowerSensorState,
    ScanState {}

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one bicycle power broadcast page. Pure: returns the next
 * state instead of mutating the given one.
 */
export function decodeBicyclePower<TState extends BicyclePowerSensorState>(
  state: Readonly<TState>,
  data: DataView,
): TState {
  const updates: Draft<BicyclePowerSensorState> = {};
  const page = data.getUint8(BUFFER_INDEX_MSG_DATA);
  switch (page) {
    case 0x01: {
      const calID = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      if (calID === 0x10) {
        const calParam = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
        if (calParam === 0x01) {
          updates.offset = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);
        }
      }
      break;
    }
    case 0x10: {
      const pedalPower = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      if (pedalPower !== 0xff) {
        if (pedalPower & 0x80) {
          updates.pedalPower = pedalPower & 0x7f;
          updates.rightPedalPower = updates.pedalPower;
          updates.leftPedalPower = 100 - updates.rightPedalPower;
        } else {
          updates.pedalPower = pedalPower & 0x7f;
          updates.rightPedalPower = undefined;
          updates.leftPedalPower = undefined;
        }
      } else {
        updates.pedalPower = undefined;
        updates.rightPedalPower = undefined;
        updates.leftPedalPower = undefined;
      }
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      if (cadence !== 0xff) {
        updates.cadence = cadence;
      } else {
        updates.cadence = undefined;
      }
      updates.accumulatedPower = data.getUint16(
        BUFFER_INDEX_MSG_DATA + 4,
        true,
      );
      updates.power = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);
      break;
    }
    case 0x20: {
      const oldEventCount = state.eventCount;
      const oldTimeStamp = state.timeStamp;
      const oldTorqueTicksStamp = state.torqueTicksStamp;

      let eventCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      const slope = data.getUint16(BUFFER_INDEX_MSG_DATA + 3, true);
      let timeStamp = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true);
      let torqueTicksStamp = data.getUint16(BUFFER_INDEX_MSG_DATA + 7, true);

      if (timeStamp !== oldTimeStamp && eventCount !== oldEventCount) {
        updates.eventCount = eventCount;
        if (oldEventCount && oldEventCount > eventCount) {
          // Hit rollover value
          eventCount += 255;
        }

        updates.timeStamp = timeStamp;
        if (oldTimeStamp && oldTimeStamp > timeStamp) {
          // Hit rollover value
          timeStamp += 65400;
        }

        updates.slope = slope;
        updates.torqueTicksStamp = torqueTicksStamp;
        if (oldTorqueTicksStamp && oldTorqueTicksStamp > torqueTicksStamp) {
          // Hit rollover value
          torqueTicksStamp += 65535;
        }

        const elapsedTime = (timeStamp - (oldTimeStamp || 0)) * 0.0005;
        const torqueTicks = torqueTicksStamp - (oldTorqueTicksStamp || 0);

        const cadencePeriod = elapsedTime / (eventCount - (oldEventCount || 0)); // s
        const cadence = Math.round(60 / cadencePeriod); // rpm
        updates.calculatedCadence = cadence;

        const torqueFrequency =
          1 / (elapsedTime / torqueTicks) - (state.offset ?? 0); // Hz
        const torque = torqueFrequency / (slope / 10); // Nm
        updates.calculatedTorque = torque;

        updates.calculatedPower = (torque * cadence * Math.PI) / 30; // Watts
      }
      break;
    }
    default:
      break;
  }

  updates.receivedAt = Date.now();

  return { ...state, ...updates } as TState;
}

export class BicyclePowerSensor extends AntPlusSensor<BicyclePowerSensorState> {
  static readonly deviceType = 0x0b;

  protected readonly deviceType = BicyclePowerSensor.deviceType;
  protected readonly period = 8182;

  protected createState(deviceId: number): BicyclePowerSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<BicyclePowerSensorState>,
    data: DataView,
  ): BicyclePowerSensorState {
    return decodeBicyclePower(state, data);
  }
}

export class BicyclePowerScanner extends AntPlusScanner<BicyclePowerScanState> {
  static readonly deviceType = 0x0b;

  protected readonly deviceType = BicyclePowerScanner.deviceType;

  protected createState(deviceId: number): BicyclePowerScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<BicyclePowerScanState>,
    data: DataView,
  ): BicyclePowerScanState {
    return decodeBicyclePower(state, data);
  }
}
