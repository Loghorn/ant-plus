/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#526_tab
 * Spec sheet: https://www.thisisant.com/resources/heart-rate-monitor/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type BatteryStatusValue,
  type ScanState,
  type SensorState,
} from "./base.js";

export interface HeartRateSensorState extends SensorState {
  readonly beatTime?: number;
  readonly beatCount?: number;
  readonly computedHeartRate?: number;
  readonly operatingTime?: number;
  readonly manId?: number;
  readonly serialNumber?: number;
  readonly hwVersion?: number;
  readonly swVersion?: number;
  readonly modelNum?: number;
  readonly previousBeat?: number;
  readonly intervalAverage?: number;
  readonly intervalMax?: number;
  readonly sessionAverage?: number;
  readonly supportedFeatures?: number;
  readonly enabledFeatures?: number;
  readonly batteryLevel?: number;
  readonly batteryVoltage?: number;
  readonly batteryStatus?: BatteryStatusValue;
  readonly receivedAt?: number;
}

export interface HeartRateScanState extends HeartRateSensorState, ScanState {}

export type PageState = "init" | "standard" | "extended";

export interface PageTracker {
  readonly oldPage: number;
  readonly pageState: PageState;
}

export const INITIAL_PAGE_TRACKER: PageTracker = {
  oldPage: -1,
  pageState: "init",
};

const TOGGLE_MASK = 0x80;

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

/**
 * Decodes one heart rate broadcast page. Pure: returns the next state
 * and the next page tracker instead of mutating either.
 */
export function decodeHeartRate<TState extends HeartRateSensorState>(
  state: Readonly<TState>,
  data: DataView,
  page: PageTracker,
): { state: TState; page: PageTracker } {
  const updates: Draft<HeartRateSensorState> = {};
  const pageNum = data.getUint8(BUFFER_INDEX_MSG_DATA);
  let pageState = page.pageState;

  if (page.pageState === "init") {
    // Change the state to "standard" and allow checking of old and new pages.
    pageState = "standard";
  } else if (pageNum !== page.oldPage || page.pageState === "extended") {
    // Decode with pages if the page byte or the toggle bit has changed.
    pageState = "extended";
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
      case 4:
        // Previous heart beat measurement time.
        updates.previousBeat = data.getUint16(BUFFER_INDEX_MSG_DATA + 2, true);
        break;
      case 5:
        updates.intervalAverage = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
        updates.intervalMax = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
        updates.sessionAverage = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
        break;
      case 6:
        updates.supportedFeatures = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
        updates.enabledFeatures = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
        break;
      case 7: {
        const batteryLevel = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
        const batteryFrac = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
        const batteryStatus = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
        if (batteryLevel !== 0xff) {
          updates.batteryLevel = batteryLevel;
        }
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
        break;
    }
  }

  // The default HRM data (last four bytes of every page).
  updates.beatTime = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
  updates.beatCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
  updates.computedHeartRate = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);
  updates.receivedAt = Date.now();

  return {
    state: { ...state, ...updates } as TState,
    page: { oldPage: pageNum, pageState },
  };
}

export class HeartRateSensor extends AntPlusSensor<HeartRateSensorState> {
  static readonly deviceType = 120;

  protected readonly deviceType = HeartRateSensor.deviceType;
  protected readonly period = 8070;

  #page: PageTracker = INITIAL_PAGE_TRACKER;

  protected createState(deviceId: number): HeartRateSensorState {
    this.#page = INITIAL_PAGE_TRACKER;
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<HeartRateSensorState>,
    data: DataView,
  ): HeartRateSensorState {
    const result = decodeHeartRate(state, data, this.#page);
    this.#page = result.page;
    return result.state;
  }
}

export class HeartRateScanner extends AntPlusScanner<HeartRateScanState> {
  static readonly deviceType = 120;

  protected readonly deviceType = HeartRateScanner.deviceType;

  #pages = new Map<number, PageTracker>();

  protected createState(deviceId: number): HeartRateScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<HeartRateScanState>,
    data: DataView,
  ): HeartRateScanState {
    const page = this.#pages.get(state.deviceId) ?? INITIAL_PAGE_TRACKER;
    const result = decodeHeartRate(state, data, page);
    this.#pages.set(state.deviceId, result.page);
    return result.state;
  }
}
