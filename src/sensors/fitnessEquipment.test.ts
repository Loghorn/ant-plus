import { describe, expect, it } from "vitest";
import {
  buildBasicResistancePayload,
  buildTargetPowerPayload,
  buildTrackResistancePayload,
  buildUserConfigurationPayload,
  buildWindResistancePayload,
  decodeFitnessEquipment,
  type FitnessEquipmentSensorState,
  resetFitnessEquipmentState,
} from "./fitnessEquipment.js";

/**
 * Wraps an 8 byte broadcast payload in a raw ANT message so the
 * payload starts at BUFFER_INDEX_MSG_DATA (4).
 */
function buildMessage(payload: number[]): DataView {
  const raw = Uint8Array.from([0xa4, payload.length, 0x4e, 0x00, ...payload]);
  return new DataView(raw.buffer);
}

const initialState: FitnessEquipmentSensorState = { deviceId: 12345 };

describe("decodeFitnessEquipment", () => {
  it("decodes the general FE page (0x10)", () => {
    // equipment type 25, elapsed 100 (25 s), distance 50, speed 2500
    // (2.5 m/s), invalid HR, capState: distance enabled + IN_USE.
    const data = buildMessage([0x10, 25, 100, 50, 0xc4, 0x09, 0xff, 0x34]);
    const state = decodeFitnessEquipment(initialState, data);

    expect(state.deviceId).toBe(12345);
    expect(state.equipmentType).toBe("Trainer/StationaryBike");
    expect(state.elapsedTime).toBe(25);
    expect(state.distance).toBe(50);
    expect(state.realSpeed).toBe(2.5);
    expect(state.virtualSpeed).toBeUndefined();
    expect(state.heartRate).toBeUndefined();
    expect(state.state).toBe("IN_USE");
    expect(state.receivedAt).toBeTypeOf("number");
  });

  it("accumulates elapsed time and distance across rollovers", () => {
    const first = decodeFitnessEquipment(
      initialState,
      buildMessage([0x10, 25, 100, 50, 0xc4, 0x09, 0xff, 0x34]),
    );
    // Elapsed rolled over: raw 20 => 5 s, old 25 s => +64 s window.
    const second = decodeFitnessEquipment(
      first,
      buildMessage([0x10, 25, 20, 60, 0xc4, 0x09, 0xff, 0x34]),
    );

    expect(second.elapsedTime).toBe(69); // 25 + (5 + 64) - 25
    expect(second.distance).toBe(60); // 50 + 60 - 50
  });

  it("decodes heart rate and virtual speed flags on page 0x10", () => {
    // HR 120 from hand contact (bits 0b11), virtual speed flag set,
    // no distance capability, READY state cleared elsewhere: use OFF.
    const data = buildMessage([0x10, 20, 0, 0, 0xe8, 0x03, 120, 0x1b]);
    const state = decodeFitnessEquipment(initialState, data);

    expect(state.equipmentType).toBe("Elliptical");
    expect(state.heartRate).toBe(120);
    expect(state.heartRateSource).toBe("HandContact");
    expect(state.virtualSpeed).toBe(1);
    expect(state.realSpeed).toBeUndefined();
    expect(state.distance).toBeUndefined();
    expect(state.state).toBe("OFF");
  });

  it("decodes the trainer power page (0x19)", () => {
    // event 1, cadence 90, accPower 300, power 250 with trainer status
    // nibble 2, flags: target on target + IN_USE.
    const data = buildMessage([0x19, 1, 90, 0x2c, 0x01, 0xfa, 0x20, 0x30]);
    const state = decodeFitnessEquipment(initialState, data);

    expect(state.eventCount0x19).toBe(1);
    expect(state.cadence).toBe(90);
    expect(state.instantaneousPower).toBe(250);
    expect(state.accumulatedPower).toBe(300);
    expect(state.averagePower).toBe(300);
    expect(state.trainerStatus).toBe(2);
    expect(state.targetStatus).toBe("OnTarget");
    expect(state.state).toBe("IN_USE");
  });

  it("averages power over the event delta on page 0x19", () => {
    const first = decodeFitnessEquipment(
      initialState,
      buildMessage([0x19, 1, 90, 0x2c, 0x01, 0xfa, 0x20, 0x30]),
    );
    // Two events later, accPower 800: (800 - 300) / (3 - 1) = 250.
    const second = decodeFitnessEquipment(
      first,
      buildMessage([0x19, 3, 90, 0x20, 0x03, 0xfa, 0x20, 0x30]),
    );

    expect(second.eventCount0x19).toBe(3);
    expect(second.accumulatedPower).toBe(800);
    expect(second.averagePower).toBe(250);
  });

  it("resets session values when the equipment reports READY", () => {
    const inUse = decodeFitnessEquipment(
      initialState,
      buildMessage([0x19, 1, 90, 0x2c, 0x01, 0xfa, 0x20, 0x30]),
    );
    // Page 0x10 with FE state READY (0x20) wipes the session values.
    const ready = decodeFitnessEquipment(
      inUse,
      buildMessage([0x10, 25, 0, 0, 0x00, 0x00, 0xff, 0x24]),
    );

    expect(ready.state).toBe("READY");
    expect(ready.cadence).toBeUndefined();
    expect(ready.instantaneousPower).toBeUndefined();
    expect(ready.accumulatedPower).toBeUndefined();
    expect(ready.averagePower).toBeUndefined();
    expect(ready.eventCount0x19).toBeUndefined();
    expect(ready.elapsedTime).toBeUndefined();
    expect(ready.distance).toBeUndefined();
    // Static values survive the reset.
    expect(ready.equipmentType).toBe("Trainer/StationaryBike");
    expect(ready.deviceId).toBe(12345);
  });

  it("collects paired devices on page 0x56", () => {
    const first = decodeFitnessEquipment(
      initialState,
      buildMessage([0x56, 0, 2, 0x80, 0x39, 0x30, 0x00, 0x78]),
    );
    const second = decodeFitnessEquipment(
      first,
      buildMessage([0x56, 1, 2, 0x00, 0x3a, 0x30, 0x00, 0x79]),
    );

    expect(second.pairedDevices).toEqual([
      { id: 0x3039, type: 0x78, paired: true },
      { id: 0x303a, type: 0x79, paired: false },
    ]);
  });

  it("keeps existing values and stamps receivedAt on unknown pages", () => {
    const known = decodeFitnessEquipment(
      initialState,
      buildMessage([0x19, 1, 90, 0x2c, 0x01, 0xfa, 0x20, 0x30]),
    );
    const state = decodeFitnessEquipment(
      known,
      buildMessage([0x70, 0, 0, 0, 0, 0, 0, 0]),
    );

    expect(state.instantaneousPower).toBe(250);
    expect(state.receivedAt).toBeTypeOf("number");
  });

  it("does not mutate the previous state", () => {
    const data = buildMessage([0x19, 1, 90, 0x2c, 0x01, 0xfa, 0x20, 0x30]);
    decodeFitnessEquipment(initialState, data);

    expect(initialState).toEqual({ deviceId: 12345 });
  });
});

describe("resetFitnessEquipmentState", () => {
  it("clears session values but keeps identity and static info", () => {
    const state = decodeFitnessEquipment(
      initialState,
      buildMessage([0x19, 1, 90, 0x2c, 0x01, 0xfa, 0x20, 0x30]),
    );
    const reset = resetFitnessEquipmentState(state);

    expect(reset.deviceId).toBe(12345);
    expect(reset.cadence).toBeUndefined();
    expect(reset.instantaneousPower).toBeUndefined();
    expect(reset.accumulatedPower).toBeUndefined();
    expect(reset.eventCount0x19).toBeUndefined();
    // The FE state itself is not part of the reset set.
    expect(reset.state).toBe("IN_USE");
  });
});

describe("buildUserConfigurationPayload", () => {
  it("uses the sentinel values when no options are given", () => {
    expect(buildUserConfigurationPayload()).toEqual([
      0x37, 0xff, 0xff, 0xff, 0xff, 0x0f, 0xff, 0x00,
    ]);
  });

  it("encodes all fields", () => {
    // userWeight 75.5 kg => 7550 (0x1d7e), bikeWeight 10 kg => 200,
    // wheelDiameter 0.7 m => offset 7 / diameter 1, gearRatio 3 => 100.
    expect(
      buildUserConfigurationPayload({
        userWeight: 75.5,
        bikeWeight: 10,
        wheelDiameter: 0.7,
        gearRatio: 3,
      }),
    ).toEqual([0x37, 0x7e, 0x1d, 0xff, 0x87, 0x0c, 0x01, 0x64]);
  });

  it("clamps user and bike weight", () => {
    const payload = buildUserConfigurationPayload({
      userWeight: 1000, // 100000 clamped to 65534 (0xfffe)
      bikeWeight: 100, // 2000 clamped to 1000 (0x3e8)
    });
    expect(payload).toEqual([0x37, 0xfe, 0xff, 0xff, 0x8f, 0x0e, 0xff, 0x00]);
  });
});

describe("buildBasicResistancePayload", () => {
  it("encodes the resistance in 0.5 % units", () => {
    expect(buildBasicResistancePayload(50)).toEqual([
      0x30, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x64,
    ]);
  });

  it("clamps to the 0-100 % range", () => {
    expect(buildBasicResistancePayload(150)[7]).toBe(0xc8);
    expect(buildBasicResistancePayload(-1)[7]).toBe(0x00);
  });
});

describe("buildTargetPowerPayload", () => {
  it("encodes the power in 0.25 W units", () => {
    expect(buildTargetPowerPayload(250)).toEqual([
      0x31, 0xff, 0xff, 0xff, 0xff, 0xff, 0xe8, 0x03,
    ]);
  });

  it("clamps to the 0-1000 W range", () => {
    expect(buildTargetPowerPayload(2000).slice(6)).toEqual([0xa0, 0x0f]);
    expect(buildTargetPowerPayload(-5).slice(6)).toEqual([0x00, 0x00]);
  });
});

describe("buildWindResistancePayload", () => {
  it("uses the sentinel values when no options are given", () => {
    expect(buildWindResistancePayload()).toEqual([
      0x32, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    ]);
  });

  it("encodes all fields", () => {
    // windCoeff 0.51 => 51, windSpeed -10 km/h => 117, draft 0.5 => 50.
    expect(
      buildWindResistancePayload({
        windCoeff: 0.51,
        windSpeed: -10,
        draftFactor: 0.5,
      }),
    ).toEqual([0x32, 0xff, 0xff, 0xff, 0xff, 0x33, 0x75, 0x32]);
  });
});

describe("buildTrackResistancePayload", () => {
  it("uses the sentinel values when no options are given", () => {
    expect(buildTrackResistancePayload()).toEqual([
      0x33, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    ]);
  });

  it("encodes all fields", () => {
    // slope 1.5 % => 20150 (0x4eb6), rr coeff 0.004 => 80 (0x50).
    expect(
      buildTrackResistancePayload({
        slope: 1.5,
        rollingResistanceCoeff: 0.004,
      }),
    ).toEqual([0x33, 0xff, 0xff, 0xff, 0xff, 0xb6, 0x4e, 0x50]);
  });
});
