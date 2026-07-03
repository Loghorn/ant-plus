/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#2343_tab
 * Spec sheet: https://www.thisisant.com/resources/ant-device-profile-muscle-oxygen/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type BatteryStatusValue,
  type ScanState,
  type SensorState,
} from "./base.js";

export type MeasurementValue = number | "AmbientLightTooHigh" | "Invalid";

export interface MuscleOxygenSensorState extends SensorState {
  readonly eventCount?: number;
  readonly utcTimeRequired?: boolean;
  readonly supportANTFS?: boolean;
  readonly measurementInterval?: 0.25 | 0.5 | 1 | 2;
  readonly totalHemoglobinConcentration?: MeasurementValue;
  readonly previousSaturatedHemoglobinPercentage?: MeasurementValue;
  readonly currentSaturatedHemoglobinPercentage?: MeasurementValue;
  readonly hwVersion?: number;
  readonly manId?: number;
  readonly modelNum?: number;
  readonly swVersion?: number;
  readonly serialNumber?: number;
  readonly operatingTime?: number;
  readonly batteryId?: number;
  readonly batteryVoltage?: number;
  readonly batteryStatus?: BatteryStatusValue;
  readonly receivedAt?: number;
}

export interface MuscleOxygenScanState
  extends MuscleOxygenSensorState,
    ScanState {}

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one muscle oxygen broadcast page. Pure: returns the next
 * state, or undefined when the page is unknown or a data page repeats
 * the previous event count (nothing new to emit).
 */
export function decodeMuscleOxygen<TState extends MuscleOxygenSensorState>(
  state: Readonly<TState>,
  data: DataView,
): TState | undefined {
  const updates: Draft<MuscleOxygenSensorState> = {};
  const oldEventCount = state.eventCount || 0;
  let newEventCount = oldEventCount;

  const page = data.getUint8(BUFFER_INDEX_MSG_DATA);
  switch (page) {
    case 0x01: {
      const eventCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      const notifications = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      const capabilities = data.getUint16(BUFFER_INDEX_MSG_DATA + 3, true);
      const total = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true) & 0xfff;
      const previous =
        (data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true) >> 4) & 0x3ff;
      const current =
        (data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true) >> 6) & 0x3ff;

      if (eventCount !== oldEventCount) {
        newEventCount = eventCount;
        updates.eventCount = eventCount;
      }

      updates.utcTimeRequired = (notifications & 0x01) === 0x01;

      updates.supportANTFS = (capabilities & 0x01) === 0x01;

      switch ((capabilities >> 1) & 0x7) {
        case 1:
          updates.measurementInterval = 0.25;
          break;
        case 2:
          updates.measurementInterval = 0.5;
          break;
        case 3:
          updates.measurementInterval = 1;
          break;
        case 4:
          updates.measurementInterval = 2;
          break;
        default:
          updates.measurementInterval = undefined;
      }

      switch (total) {
        case 0xffe:
          updates.totalHemoglobinConcentration = "AmbientLightTooHigh";
          break;
        case 0xfff:
          updates.totalHemoglobinConcentration = "Invalid";
          break;
        default:
          updates.totalHemoglobinConcentration = total;
      }

      switch (previous) {
        case 0x3fe:
          updates.previousSaturatedHemoglobinPercentage = "AmbientLightTooHigh";
          break;
        case 0x3ff:
          updates.previousSaturatedHemoglobinPercentage = "Invalid";
          break;
        default:
          updates.previousSaturatedHemoglobinPercentage = previous;
      }

      switch (current) {
        case 0x3fe:
          updates.currentSaturatedHemoglobinPercentage = "AmbientLightTooHigh";
          break;
        case 0x3ff:
          updates.currentSaturatedHemoglobinPercentage = "Invalid";
          break;
        default:
          updates.currentSaturatedHemoglobinPercentage = current;
      }

      break;
    }
    case 0x50: {
      updates.hwVersion = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      updates.manId = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
      updates.modelNum = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);
      break;
    }
    case 0x51: {
      const swRevSup = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      const swRevMain = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const serial = data.getInt32(BUFFER_INDEX_MSG_DATA + 4, true);

      updates.swVersion = swRevMain;

      if (swRevSup !== 0xff) {
        updates.swVersion += swRevSup / 1000;
      }

      if (serial !== 0xffffffff) {
        updates.serialNumber = serial;
      }

      break;
    }
    case 0x52: {
      updates.batteryId = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      const operatingTime =
        data.getUint32(BUFFER_INDEX_MSG_DATA + 3, true) & 0xffffff;
      const batteryFrac = data.getInt32(BUFFER_INDEX_MSG_DATA + 6, true);
      const batteryStatus = data.getInt32(BUFFER_INDEX_MSG_DATA + 7, true);

      updates.operatingTime =
        operatingTime * ((batteryStatus & 0x80) === 0x80 ? 2 : 16);
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
    default:
      return undefined;
  }

  updates.receivedAt = Date.now();
  if (page !== 0x01 || newEventCount !== oldEventCount) {
    return { ...state, ...updates } as TState;
  }
  return undefined;
}

export type TimeCommand = 0x00 | 0x01 | 0x02 | 0x03;

export interface TimeCommandOptions {
  /** The wall clock time to encode. Defaults to the current time. */
  readonly time?: Date;
}

/**
 * Builds the "set time" command payload (data page 0x10). The UTC
 * timestamp counts seconds since the ANT+ epoch (1989-12-31T00:00Z)
 * and the local time offset is encoded in 15 minute steps.
 */
export function buildTimeCommandPayload(cmd: TimeCommand, now: Date): number[] {
  const utc = Math.round(
    (now.getTime() - Date.UTC(1989, 11, 31, 0, 0, 0, 0)) / 1000,
  );
  const offset = -Math.round(now.getTimezoneOffset() / 15);
  return [
    0x10,
    cmd & 0xff,
    0xff,
    offset & 0xff,
    (utc >> 0) & 0xff,
    (utc >> 8) & 0xff,
    (utc >> 16) & 0xff,
    (utc >> 24) & 0xff,
  ];
}

export class MuscleOxygenSensor extends AntPlusSensor<MuscleOxygenSensorState> {
  static readonly deviceType = 0x1f;

  protected readonly deviceType = MuscleOxygenSensor.deviceType;
  protected readonly period = 8192;

  protected createState(deviceId: number): MuscleOxygenSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<MuscleOxygenSensorState>,
    data: DataView,
  ): MuscleOxygenSensorState | undefined {
    return decodeMuscleOxygen(state, data);
  }

  #sendTimeCommand(
    cmd: TimeCommand,
    options: TimeCommandOptions,
  ): Promise<boolean> {
    return this.sendAcknowledgedData(
      buildTimeCommandPayload(cmd, options.time ?? new Date()),
    );
  }

  /** Sends the device the current UTC time. */
  setUTCTime(options: TimeCommandOptions = {}): Promise<boolean> {
    return this.#sendTimeCommand(0x00, options);
  }

  /** Starts a new session on the device. */
  startSession(options: TimeCommandOptions = {}): Promise<boolean> {
    return this.#sendTimeCommand(0x01, options);
  }

  /** Stops the current session on the device. */
  stopSession(options: TimeCommandOptions = {}): Promise<boolean> {
    return this.#sendTimeCommand(0x02, options);
  }

  /** Marks a lap in the current session. */
  setLap(options: TimeCommandOptions = {}): Promise<boolean> {
    return this.#sendTimeCommand(0x03, options);
  }
}

export class MuscleOxygenScanner extends AntPlusScanner<MuscleOxygenScanState> {
  static readonly deviceType = 0x1f;

  protected readonly deviceType = MuscleOxygenScanner.deviceType;

  protected createState(deviceId: number): MuscleOxygenScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<MuscleOxygenScanState>,
    data: DataView,
  ): MuscleOxygenScanState | undefined {
    return decodeMuscleOxygen(state, data);
  }
}
