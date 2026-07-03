import { describe, expect, it } from "vitest";
import {
  buildTimeCommandPayload,
  decodeMuscleOxygen,
  type MuscleOxygenSensorState,
} from "./muscleOxygen.js";

/**
 * Builds a raw ANT message whose payload starts at byte offset 4
 * (BUFFER_INDEX_MSG_DATA): [0xa4, len, msgType, channel, ...payload].
 */
function makeMessage(payload: number[]): DataView {
  const bytes = [0xa4, payload.length, 0x4e, 0x00, ...payload];
  return new DataView(Uint8Array.from(bytes).buffer);
}

const initialState: MuscleOxygenSensorState = { deviceId: 1234 };

describe("decodeMuscleOxygen", () => {
  it("decodes data page 0x01", () => {
    // payload[3] = 0x07 -> capabilities: ANTFS bit set, interval code 3 (1s)
    // total   = u16le(0x34, 0x12) & 0xfff        = 0x234
    // previous = (u16le(0x12, 0x30) >> 4) & 0x3ff = 0x301
    // current  = (u16le(0x30, 0x0f) >> 6) & 0x3ff = 0x03c
    const data = makeMessage([0x01, 1, 0x01, 0x07, 0x34, 0x12, 0x30, 0x0f]);
    const state = decodeMuscleOxygen(initialState, data);

    expect(state).toMatchObject({
      deviceId: 1234,
      eventCount: 1,
      utcTimeRequired: true,
      supportANTFS: true,
      measurementInterval: 1,
      totalHemoglobinConcentration: 0x234,
      previousSaturatedHemoglobinPercentage: 0x301,
      currentSaturatedHemoglobinPercentage: 0x3c,
    });
    expect(state?.receivedAt).toBeTypeOf("number");
  });

  it("maps reserved measurement values on page 0x01", () => {
    // total = 0xffe, previous = 0x3ff, current = 0x3fe
    const data = makeMessage([0x01, 1, 0x00, 0x00, 0xfe, 0xff, 0xbf, 0xff]);
    const state = decodeMuscleOxygen(initialState, data);

    expect(state).toMatchObject({
      utcTimeRequired: false,
      supportANTFS: false,
      measurementInterval: undefined,
      totalHemoglobinConcentration: "AmbientLightTooHigh",
      previousSaturatedHemoglobinPercentage: "Invalid",
      currentSaturatedHemoglobinPercentage: "AmbientLightTooHigh",
    });
  });

  it("returns undefined when the event count has not changed", () => {
    const data = makeMessage([0x01, 1, 0x01, 0x07, 0x34, 0x12, 0x30, 0x0f]);
    const first = decodeMuscleOxygen(initialState, data);
    expect(first).toBeDefined();
    if (!first) {
      return;
    }

    // Same event count again: no emit.
    expect(decodeMuscleOxygen(first, data)).toBeUndefined();

    // A new event count emits again.
    const next = makeMessage([0x01, 2, 0x01, 0x07, 0x34, 0x12, 0x30, 0x0f]);
    expect(decodeMuscleOxygen(first, next)).toMatchObject({ eventCount: 2 });
  });

  it("returns undefined for unknown pages", () => {
    const data = makeMessage([0x00, 0, 0, 0, 0, 0, 0, 0]);
    expect(decodeMuscleOxygen(initialState, data)).toBeUndefined();
  });

  it("decodes manufacturer info (page 0x50)", () => {
    const data = makeMessage([0x50, 0xff, 0xff, 0x03, 0x0f, 0x00, 0x02, 0x01]);
    const state = decodeMuscleOxygen(initialState, data);

    expect(state).toMatchObject({
      hwVersion: 3,
      manId: 0x000f,
      modelNum: 0x0102,
    });
  });

  it("decodes product info (page 0x51)", () => {
    const data = makeMessage([0x51, 0xff, 0x02, 0x05, 0x78, 0x56, 0x34, 0x12]);
    const state = decodeMuscleOxygen(initialState, data);

    expect(state).toMatchObject({
      swVersion: 5.002,
      serialNumber: 0x12345678,
    });
  });

  it("omits the supplemental revision when it reads 0xff (page 0x51)", () => {
    const data = makeMessage([0x51, 0xff, 0xff, 0x05, 0x78, 0x56, 0x34, 0x12]);
    expect(decodeMuscleOxygen(initialState, data)).toMatchObject({
      swVersion: 5,
    });
  });

  it("decodes battery status (page 0x52)", () => {
    // The legacy decoder reads batteryFrac/batteryStatus as overlapping
    // 32 bit values past the battery byte; pad the message accordingly.
    // batteryStatus byte 0xa3: coarse voltage 3, flags 2 (Good), time
    // resolution bit set (2 second units).
    const data = makeMessage([
      0x52, 0xff, 0x05, 0x10, 0x00, 0x00, 0x00, 0xa3, 0x00, 0x00, 0x00,
    ]);
    const state = decodeMuscleOxygen(initialState, data);

    expect(state).toMatchObject({
      batteryId: 5,
      operatingTime: 0x10 * 2,
      batteryVoltage: 3 + 0xa300 / 256,
      batteryStatus: "Good",
    });
  });

  it("marks unknown battery flags invalid (page 0x52)", () => {
    // batteryStatus byte 0x03: flags 0 -> Invalid, voltage cleared,
    // 16 second operating time units.
    const data = makeMessage([
      0x52, 0xff, 0x05, 0x10, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00,
    ]);
    const state = decodeMuscleOxygen(initialState, data);

    expect(state).toMatchObject({
      operatingTime: 0x10 * 16,
      batteryVoltage: undefined,
      batteryStatus: "Invalid",
    });
  });

  it("does not mutate the previous state", () => {
    const data = makeMessage([0x50, 0xff, 0xff, 0x03, 0x0f, 0x00, 0x02, 0x01]);
    decodeMuscleOxygen(initialState, data);
    expect(initialState).toEqual({ deviceId: 1234 });
  });
});

describe("buildTimeCommandPayload", () => {
  it("encodes the command and UTC seconds since the ANT+ epoch", () => {
    const time = new Date(Date.UTC(2020, 0, 1));
    // (2020-01-01T00:00Z - 1989-12-31T00:00Z) / 1000 = 946771200
    // = 0x386e9500, little endian in the last four bytes.
    const offset = -Math.round(time.getTimezoneOffset() / 15) & 0xff;

    expect(buildTimeCommandPayload(0x01, time)).toEqual([
      0x10,
      0x01,
      0xff,
      offset,
      0x00,
      0x95,
      0x6e,
      0x38,
    ]);
  });

  it("encodes each command id", () => {
    const time = new Date(Date.UTC(2020, 0, 1));
    expect(buildTimeCommandPayload(0x00, time)[1]).toBe(0x00);
    expect(buildTimeCommandPayload(0x02, time)[1]).toBe(0x02);
    expect(buildTimeCommandPayload(0x03, time)[1]).toBe(0x03);
  });
});
