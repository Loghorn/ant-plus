/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#525_tab
 * Spec sheet: https://www.thisisant.com/resources/fitness-equipment-device/
 */

import { BUFFER_INDEX_MSG_DATA } from "../messages.js";
import {
  AntPlusScanner,
  AntPlusSensor,
  type ScanState,
  type SensorState,
} from "./base.js";

export type EquipmentTypeValue =
  | "Treadmill"
  | "Elliptical"
  | "Reserved"
  | "Rower"
  | "Climber"
  | "NordicSkier"
  | "Trainer/StationaryBike"
  | "General";

export type HeartRateSourceValue = "HandContact" | "EM" | "ANT+";

export type EquipmentStateValue = "OFF" | "READY" | "IN_USE" | "FINISHED";

export type TargetStatusValue = "OnTarget" | "LowSpeed" | "HighSpeed";

export interface PairedDevice {
  readonly id: number;
  readonly type: number;
  readonly paired: boolean;
}

export interface FitnessEquipmentSensorState extends SensorState {
  /** Internal accumulator for the page 0x19 event count. */
  readonly eventCount0x19?: number;
  /** Internal accumulator for the page 0x1A event count. */
  readonly eventCount0x1A?: number;
  readonly temperature?: number;
  readonly zeroOffset?: number;
  readonly spinDownTime?: number;
  readonly equipmentType?: EquipmentTypeValue;
  readonly elapsedTime?: number;
  readonly distance?: number;
  readonly realSpeed?: number;
  readonly virtualSpeed?: number;
  readonly heartRate?: number;
  readonly heartRateSource?: HeartRateSourceValue;
  readonly state?: EquipmentStateValue;
  readonly cycleLength?: number;
  readonly incline?: number;
  readonly resistance?: number;
  readonly mets?: number;
  readonly caloricBurnRate?: number;
  readonly calories?: number;
  readonly ascendedDistance?: number;
  readonly descendedDistance?: number;
  readonly strides?: number;
  readonly strokes?: number;
  readonly cadence?: number;
  readonly accumulatedPower?: number;
  readonly instantaneousPower?: number;
  readonly averagePower?: number;
  readonly trainerStatus?: number;
  readonly targetStatus?: TargetStatusValue;
  readonly wheelTicks?: number;
  readonly wheelPeriod?: number;
  readonly torque?: number;
  readonly hwVersion?: number;
  readonly manId?: number;
  readonly modelNum?: number;
  readonly swVersion?: number;
  readonly serialNumber?: number;
  readonly pairedDevices?: readonly PairedDevice[];
  readonly receivedAt?: number;
}

export interface FitnessEquipmentScanState
  extends FitnessEquipmentSensorState,
    ScanState {}

type Draft<T> = { -readonly [K in keyof T]?: T[K] };

const RESET_UPDATES: Draft<FitnessEquipmentSensorState> = {
  elapsedTime: undefined,
  distance: undefined,
  realSpeed: undefined,
  virtualSpeed: undefined,
  heartRate: undefined,
  heartRateSource: undefined,
  cycleLength: undefined,
  incline: undefined,
  resistance: undefined,
  mets: undefined,
  caloricBurnRate: undefined,
  calories: undefined,
  eventCount0x19: undefined,
  eventCount0x1A: undefined,
  cadence: undefined,
  accumulatedPower: undefined,
  instantaneousPower: undefined,
  averagePower: undefined,
  trainerStatus: undefined,
  targetStatus: undefined,
  ascendedDistance: undefined,
  descendedDistance: undefined,
  strides: undefined,
  strokes: undefined,
  wheelTicks: undefined,
  wheelPeriod: undefined,
  torque: undefined,
};

/**
 * Clears all session values (accumulators, live measurements) while
 * keeping device identity and static information. Pure: returns a new
 * state object.
 */
export function resetFitnessEquipmentState<
  TState extends FitnessEquipmentSensorState,
>(state: Readonly<TState>): TState {
  return { ...state, ...RESET_UPDATES } as TState;
}

/**
 * Decodes the "FE state" nibble shared by most data pages. Entering the
 * READY state resets the session values, matching the legacy behaviour.
 */
function applyEquipmentState(
  updates: Draft<FitnessEquipmentSensorState>,
  stateBits: number,
): void {
  switch (stateBits) {
    case 1:
      updates.state = "OFF";
      break;
    case 2:
      updates.state = "READY";
      Object.assign(updates, RESET_UPDATES);
      break;
    case 3:
      updates.state = "IN_USE";
      break;
    case 4:
      updates.state = "FINISHED";
      break;
    default:
      updates.state = undefined;
      break;
  }
}

/**
 * Decodes one fitness equipment broadcast page. Pure: returns the next
 * state instead of mutating the given one.
 */
export function decodeFitnessEquipment<
  TState extends FitnessEquipmentSensorState,
>(state: Readonly<TState>, data: DataView): TState {
  const updates: Draft<FitnessEquipmentSensorState> = {};
  const page = data.getUint8(BUFFER_INDEX_MSG_DATA);
  switch (page) {
    case 0x01: {
      // Calibration request/response.
      const temperature = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      if (temperature !== 0xff) {
        updates.temperature = -25 + temperature * 0.5;
      }
      const calBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      if (calBF & 0x40) {
        updates.zeroOffset = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
      }
      if (calBF & 0x80) {
        updates.spinDownTime = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);
      }
      break;
    }
    case 0x10: {
      // General FE data.
      const equipmentTypeBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      switch (equipmentTypeBF & 0x1f) {
        case 19:
          updates.equipmentType = "Treadmill";
          break;
        case 20:
          updates.equipmentType = "Elliptical";
          break;
        case 21:
          updates.equipmentType = "Reserved";
          break;
        case 22:
          updates.equipmentType = "Rower";
          break;
        case 23:
          updates.equipmentType = "Climber";
          break;
        case 24:
          updates.equipmentType = "NordicSkier";
          break;
        case 25:
          updates.equipmentType = "Trainer/StationaryBike";
          break;
        default:
          updates.equipmentType = "General";
          break;
      }
      let elapsedTime = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      let distance = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const speed = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
      const heartRate = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
      const capStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);
      if (heartRate !== 0xff) {
        switch (capStateBF & 0x03) {
          case 3: {
            updates.heartRate = heartRate;
            updates.heartRateSource = "HandContact";
            break;
          }
          case 2: {
            updates.heartRate = heartRate;
            updates.heartRateSource = "EM";
            break;
          }
          case 1: {
            updates.heartRate = heartRate;
            updates.heartRateSource = "ANT+";
            break;
          }
          default: {
            updates.heartRate = undefined;
            updates.heartRateSource = undefined;
            break;
          }
        }
      }

      elapsedTime /= 4;
      const oldElapsedTime = (state.elapsedTime || 0) % 64;
      if (elapsedTime !== oldElapsedTime) {
        if (oldElapsedTime > elapsedTime) {
          // Hit rollover value
          elapsedTime += 64;
        }
      }
      updates.elapsedTime =
        (state.elapsedTime || 0) + elapsedTime - oldElapsedTime;

      if (capStateBF & 0x04) {
        const oldDistance = (state.distance || 0) % 256;
        if (distance !== oldDistance) {
          if (oldDistance > distance) {
            // Hit rollover value
            distance += 256;
          }
        }
        updates.distance = (state.distance || 0) + distance - oldDistance;
      } else {
        updates.distance = undefined;
      }
      if (capStateBF & 0x08) {
        updates.virtualSpeed = speed / 1000;
        updates.realSpeed = undefined;
      } else {
        updates.virtualSpeed = undefined;
        updates.realSpeed = speed / 1000;
      }
      applyEquipmentState(updates, (capStateBF & 0x70) >> 4);
      if (capStateBF & 0x80) {
        // lap
      }
      break;
    }
    case 0x11: {
      // General settings.
      const cycleLen = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const incline = data.getInt16(BUFFER_INDEX_MSG_DATA + 4, true);
      const resistance = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
      const capStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);
      if (cycleLen !== 0xff) {
        updates.cycleLength = cycleLen / 100;
      }
      if (incline >= -10000 && incline <= 10000) {
        updates.incline = incline / 100;
      }
      if (resistance !== 0xff) {
        updates.resistance = resistance;
      }
      applyEquipmentState(updates, (capStateBF & 0x70) >> 4);
      if (capStateBF & 0x80) {
        // lap
      }
      break;
    }
    case 0x12: {
      // General FE metabolic data.
      const mets = data.getUint16(BUFFER_INDEX_MSG_DATA + 2, true);
      const caloricbr = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
      const calories = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
      const capStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);
      if (mets !== 0xffff) {
        updates.mets = mets / 100;
      }
      if (caloricbr !== 0xffff) {
        updates.caloricBurnRate = caloricbr / 10;
      }
      if (capStateBF & 0x01) {
        updates.calories = calories;
      }
      applyEquipmentState(updates, (capStateBF & 0x70) >> 4);
      if (capStateBF & 0x80) {
        // lap
      }
      break;
    }
    case 0x13: {
      // Treadmill-specific data.
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 4);
      let negDistance = data.getUint8(BUFFER_INDEX_MSG_DATA + 5);
      let posDistance = data.getUint8(BUFFER_INDEX_MSG_DATA + 6);
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (cadence !== 0xff) {
        updates.cadence = cadence;
      }

      if (flagStateBF & 0x02) {
        const oldNegDistance = (state.descendedDistance || 0) % 256;
        if (negDistance !== oldNegDistance) {
          if (oldNegDistance > negDistance) {
            negDistance += 256;
          }
        }
        updates.descendedDistance =
          (state.descendedDistance || 0) + negDistance - oldNegDistance;
      }

      if (flagStateBF & 0x01) {
        const oldPosDistance = (state.ascendedDistance || 0) % 256;
        if (posDistance !== oldPosDistance) {
          if (oldPosDistance > posDistance) {
            posDistance += 256;
          }
        }
        updates.ascendedDistance =
          (state.ascendedDistance || 0) + posDistance - oldPosDistance;
      }

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x14: {
      // Elliptical-specific data.
      let posDistance = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      let strides = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 4);
      const power = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true);
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (cadence !== 0xff) {
        updates.cadence = cadence;
      }

      if (power !== 0xffff) {
        updates.instantaneousPower = power;
      }

      if (flagStateBF & 0x02) {
        const oldPosDistance = (state.ascendedDistance || 0) % 256;
        if (posDistance !== oldPosDistance) {
          if (oldPosDistance > posDistance) {
            posDistance += 256;
          }
        }
        updates.ascendedDistance =
          (state.ascendedDistance || 0) + posDistance - oldPosDistance;
      }

      if (flagStateBF & 0x01) {
        const oldStrides = (state.strides || 0) % 256;
        if (strides !== oldStrides) {
          if (oldStrides > strides) {
            strides += 256;
          }
        }
        updates.strides = (state.strides || 0) + strides - oldStrides;
      }

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x16: {
      // Rower-specific data.
      let strokes = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 4);
      const power = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true);
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (cadence !== 0xff) {
        updates.cadence = cadence;
      }

      if (power !== 0xffff) {
        updates.instantaneousPower = power;
      }

      if (flagStateBF & 0x01) {
        const oldStrokes = (state.strokes || 0) % 256;
        if (strokes !== oldStrokes) {
          if (oldStrokes > strokes) {
            strokes += 256;
          }
        }
        updates.strokes = (state.strokes || 0) + strokes - oldStrokes;
      }

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x17: {
      // Climber-specific data.
      let strides = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 4);
      const power = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true);
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (cadence !== 0xff) {
        updates.cadence = cadence;
      }

      if (power !== 0xffff) {
        updates.instantaneousPower = power;
      }

      if (flagStateBF & 0x01) {
        const oldStrides = (state.strides || 0) % 256;
        if (strides !== oldStrides) {
          if (oldStrides > strides) {
            strides += 256;
          }
        }
        updates.strides = (state.strides || 0) + strides - oldStrides;
      }

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x18: {
      // Nordic skier-specific data.
      let strides = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 4);
      const power = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true);
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (cadence !== 0xff) {
        updates.cadence = cadence;
      }

      if (power !== 0xffff) {
        updates.instantaneousPower = power;
      }

      if (flagStateBF & 0x01) {
        const oldStrides = (state.strides || 0) % 256;
        if (strides !== oldStrides) {
          if (oldStrides > strides) {
            strides += 256;
          }
        }
        updates.strides = (state.strides || 0) + strides - oldStrides;
      }

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x19: {
      // Trainer/stationary bike-specific data (power).
      const oldEventCount = state.eventCount0x19 || 0;

      let eventCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      const cadence = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      let accPower = data.getUint16(BUFFER_INDEX_MSG_DATA + 3, true);
      const power = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true) & 0xfff;
      const trainerStatus = data.getUint8(BUFFER_INDEX_MSG_DATA + 6) >> 4;
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (eventCount !== oldEventCount) {
        updates.eventCount0x19 = eventCount;
        if (oldEventCount > eventCount) {
          // Hit rollover value
          eventCount += 255;
        }
      }

      if (cadence !== 0xff) {
        updates.cadence = cadence;
      }

      if (power !== 0xfff) {
        updates.instantaneousPower = power;

        const oldAccPower = (state.accumulatedPower || 0) % 65536;
        if (accPower !== oldAccPower) {
          if (oldAccPower > accPower) {
            accPower += 65536;
          }
        }
        updates.accumulatedPower =
          (state.accumulatedPower || 0) + accPower - oldAccPower;

        updates.averagePower =
          (accPower - oldAccPower) / (eventCount - oldEventCount);
      }

      updates.trainerStatus = trainerStatus;

      switch (flagStateBF & 0x03) {
        case 0:
          updates.targetStatus = "OnTarget";
          break;
        case 1:
          updates.targetStatus = "LowSpeed";
          break;
        case 2:
          updates.targetStatus = "HighSpeed";
          break;
        default:
          updates.targetStatus = undefined;
          break;
      }

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x1a: {
      // Trainer/stationary bike-specific data (torque).
      const oldEventCount = state.eventCount0x1A || 0;

      let eventCount = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      let wheelTicks = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      let accWheelPeriod = data.getUint16(BUFFER_INDEX_MSG_DATA + 3, true);
      let accTorque = data.getUint16(BUFFER_INDEX_MSG_DATA + 5, true);
      const flagStateBF = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      if (eventCount !== oldEventCount) {
        updates.eventCount0x1A = eventCount;
        if (oldEventCount > eventCount) {
          // Hit rollover value
          eventCount += 255;
        }
      }

      const oldWheelTicks = (state.wheelTicks || 0) % 256;
      if (wheelTicks !== oldWheelTicks) {
        if (oldWheelTicks > wheelTicks) {
          wheelTicks += 65536;
        }
      }
      updates.wheelTicks = (state.wheelTicks || 0) + wheelTicks - oldWheelTicks;

      const oldWheelPeriod = (state.wheelPeriod || 0) % 256;
      if (accWheelPeriod !== oldWheelPeriod) {
        if (oldWheelPeriod > accWheelPeriod) {
          accWheelPeriod += 65536;
        }
      }
      updates.wheelPeriod =
        (state.wheelPeriod || 0) + accWheelPeriod - oldWheelPeriod;

      const oldTorque = (state.torque || 0) % 256;
      if (accTorque !== oldTorque) {
        if (oldTorque > accTorque) {
          accTorque += 65536;
        }
      }
      updates.torque = (state.torque || 0) + accTorque - oldTorque;

      applyEquipmentState(updates, (flagStateBF & 0x70) >> 4);
      if (flagStateBF & 0x80) {
        // lap
      }

      break;
    }
    case 0x50: {
      // Manufacturer's information.
      updates.hwVersion = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      updates.manId = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
      updates.modelNum = data.getUint16(BUFFER_INDEX_MSG_DATA + 6, true);
      break;
    }
    case 0x51: {
      // Product information.
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
    case 0x56: {
      // Paired devices.
      const idx = data.getUint8(BUFFER_INDEX_MSG_DATA + 1);
      const tot = data.getUint8(BUFFER_INDEX_MSG_DATA + 2);
      const chState = data.getUint8(BUFFER_INDEX_MSG_DATA + 3);
      const devId = data.getUint16(BUFFER_INDEX_MSG_DATA + 4, true);
      const devType = data.getUint8(BUFFER_INDEX_MSG_DATA + 7);

      let pairedDevices = state.pairedDevices ?? [];

      if (idx === 0) {
        pairedDevices = [];
      }

      if (tot > 0) {
        pairedDevices = [
          ...pairedDevices,
          {
            id: devId,
            type: devType,
            paired: !!(chState & 0x80),
          },
        ];
      }

      updates.pairedDevices = pairedDevices;

      break;
    }
    default:
      break;
  }

  updates.receivedAt = Date.now();

  return { ...state, ...updates } as TState;
}

export interface UserConfigurationOptions {
  /** User weight in kg. */
  userWeight?: number;
  /** Bicycle weight in kg. */
  bikeWeight?: number;
  /** Bicycle wheel diameter in m. */
  wheelDiameter?: number;
  /** Front-to-rear gear ratio. */
  gearRatio?: number;
}

export interface WindResistanceOptions {
  /** Wind resistance coefficient in kg/m. */
  windCoeff?: number;
  /** Wind speed in km/h (head wind positive, tail wind negative). */
  windSpeed?: number;
  /** Drafting factor from 0 to 1. */
  draftFactor?: number;
}

export interface TrackResistanceOptions {
  /** Grade in %. */
  slope?: number;
  /** Coefficient of rolling resistance. */
  rollingResistanceCoeff?: number;
}

/** Builds the page 0x37 (user configuration) payload. */
export function buildUserConfigurationPayload(
  options: UserConfigurationOptions = {},
): number[] {
  const { userWeight, bikeWeight, wheelDiameter, gearRatio } = options;
  const m =
    userWeight === undefined
      ? 0xffff
      : Math.max(0, Math.min(65534, Math.round(userWeight * 100)));
  const df =
    wheelDiameter === undefined ? 0xff : Math.round(wheelDiameter * 10) % 10;
  const mb =
    bikeWeight === undefined
      ? 0xfff
      : Math.max(0, Math.min(1000, Math.round(bikeWeight * 20)));
  const d =
    wheelDiameter === undefined
      ? 0xff
      : Math.max(0, Math.min(254, Math.round(wheelDiameter)));
  const gr =
    gearRatio === undefined
      ? 0x00
      : Math.max(1, Math.min(255, Math.round(gearRatio / 0.03)));
  return [
    0x37,
    m & 0xff,
    (m >> 8) & 0xff,
    0xff,
    (df & 0xf) | ((mb & 0xf) << 4),
    (mb >> 4) & 0xf,
    d & 0xff,
    gr & 0xff,
  ];
}

/** Builds the page 0x30 (basic resistance) payload. */
export function buildBasicResistancePayload(resistance: number): number[] {
  const res = Math.max(0, Math.min(200, Math.round(resistance * 2)));
  return [0x30, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, res & 0xff];
}

/** Builds the page 0x31 (target power) payload. */
export function buildTargetPowerPayload(power: number): number[] {
  const p = Math.max(0, Math.min(4000, Math.round(power * 4)));
  return [0x31, 0xff, 0xff, 0xff, 0xff, 0xff, p & 0xff, (p >> 8) & 0xff];
}

/** Builds the page 0x32 (wind resistance) payload. */
export function buildWindResistancePayload(
  options: WindResistanceOptions = {},
): number[] {
  const { windCoeff, windSpeed, draftFactor } = options;
  const wc =
    windCoeff === undefined
      ? 0xff
      : Math.max(0, Math.min(186, Math.round(windCoeff * 100)));
  const ws =
    windSpeed === undefined
      ? 0xff
      : Math.max(0, Math.min(254, Math.round(windSpeed + 127)));
  const df =
    draftFactor === undefined
      ? 0xff
      : Math.max(0, Math.min(100, Math.round(draftFactor * 100)));
  return [0x32, 0xff, 0xff, 0xff, 0xff, wc & 0xff, ws & 0xff, df & 0xff];
}

/** Builds the page 0x33 (track resistance) payload. */
export function buildTrackResistancePayload(
  options: TrackResistanceOptions = {},
): number[] {
  const { slope, rollingResistanceCoeff } = options;
  const s =
    slope === undefined
      ? 0xffff
      : Math.max(0, Math.min(40000, Math.round((slope + 200) * 100)));
  const rr =
    rollingResistanceCoeff === undefined
      ? 0xff
      : Math.max(0, Math.min(254, Math.round(rollingResistanceCoeff * 20000)));
  return [0x33, 0xff, 0xff, 0xff, 0xff, s & 0xff, (s >> 8) & 0xff, rr & 0xff];
}

export class FitnessEquipmentSensor extends AntPlusSensor<FitnessEquipmentSensorState> {
  static readonly deviceType = 0x11;

  protected readonly deviceType = FitnessEquipmentSensor.deviceType;
  protected readonly period = 8192;

  protected createState(deviceId: number): FitnessEquipmentSensorState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<FitnessEquipmentSensorState>,
    data: DataView,
  ): FitnessEquipmentSensorState {
    return decodeFitnessEquipment(state, data);
  }

  /**
   * Sends the user configuration (page 0x37). Resolves with the
   * delivery result reported by the stick.
   */
  setUserConfiguration(
    options: UserConfigurationOptions = {},
  ): Promise<boolean> {
    return this.sendAcknowledgedData(buildUserConfigurationPayload(options));
  }

  /**
   * Sets the basic resistance (page 0x30) as a percentage from 0 to
   * 100. Resolves with the delivery result reported by the stick.
   */
  setBasicResistance(resistance: number): Promise<boolean> {
    return this.sendAcknowledgedData(buildBasicResistancePayload(resistance));
  }

  /**
   * Sets the target power (page 0x31) in watts. Resolves with the
   * delivery result reported by the stick.
   */
  setTargetPower(power: number): Promise<boolean> {
    return this.sendAcknowledgedData(buildTargetPowerPayload(power));
  }

  /**
   * Sets the wind resistance simulation parameters (page 0x32).
   * Resolves with the delivery result reported by the stick.
   */
  setWindResistance(options: WindResistanceOptions = {}): Promise<boolean> {
    return this.sendAcknowledgedData(buildWindResistancePayload(options));
  }

  /**
   * Sets the track resistance simulation parameters (page 0x33).
   * Resolves with the delivery result reported by the stick.
   */
  setTrackResistance(options: TrackResistanceOptions = {}): Promise<boolean> {
    return this.sendAcknowledgedData(buildTrackResistancePayload(options));
  }
}

export class FitnessEquipmentScanner extends AntPlusScanner<FitnessEquipmentScanState> {
  static readonly deviceType = 0x11;

  protected readonly deviceType = FitnessEquipmentScanner.deviceType;

  protected createState(deviceId: number): FitnessEquipmentScanState {
    return { deviceId };
  }

  protected decodeState(
    state: Readonly<FitnessEquipmentScanState>,
    data: DataView,
  ): FitnessEquipmentScanState {
    return decodeFitnessEquipment(state, data);
  }
}
