import { describe, expect, it } from "vitest";
import {
  decodeSpeedCadence,
  type SpeedCadenceSensorState,
} from "./speedCadence.js";

const WHEEL_CIRCUMFERENCE = 2.199;

/**
 * Builds a raw broadcast message: [0xa4, len, msgType, channel, ...payload].
 * The payload starts at BUFFER_INDEX_MSG_DATA (4). Note the legacy
 * decoder reads the cadence event time as big-endian while the other
 * three fields are little-endian.
 */
function makeData(
  cadenceTime: number,
  cadenceCount: number,
  speedTime: number,
  speedCount: number,
): DataView {
  const view = new DataView(new ArrayBuffer(12));
  view.setUint8(0, 0xa4);
  view.setUint8(1, 8);
  view.setUint8(2, 0x4e);
  view.setUint8(3, 0);
  view.setUint16(4, cadenceTime, false);
  view.setUint16(6, cadenceCount, true);
  view.setUint16(8, speedTime, true);
  view.setUint16(10, speedCount, true);
  return view;
}

describe("decodeSpeedCadence", () => {
  it("decodes cadence and speed on the first message", () => {
    const state: SpeedCadenceSensorState = { deviceId: 12345 };
    const next = decodeSpeedCadence(
      state,
      makeData(1024, 2, 2048, 4),
      WHEEL_CIRCUMFERENCE,
    );

    expect(next).toBeDefined();
    expect(next?.deviceId).toBe(12345);
    expect(next?.cadenceEventTime).toBe(1024);
    expect(next?.cumulativeCadenceRevolutionCount).toBe(2);
    expect(next?.speedEventTime).toBe(2048);
    expect(next?.cumulativeSpeedRevolutionCount).toBe(4);
    // cadence = 60 * 2 * 1024 / 1024 = 120 rpm
    expect(next?.calculatedCadence).toBe(120);
    // distance = 2.199 * 4 = 8.796 m
    expect(next?.calculatedDistance).toBeCloseTo(8.796, 10);
    // speed = 8.796 * 1024 / 2048 = 4.398 m/s
    expect(next?.calculatedSpeed).toBeCloseTo(4.398, 10);
    expect(next?.receivedAt).toBeTypeOf("number");
  });

  it("computes deltas against the previous message", () => {
    const state: SpeedCadenceSensorState = { deviceId: 1 };
    const first = decodeSpeedCadence(
      state,
      makeData(1024, 2, 2048, 4),
      WHEEL_CIRCUMFERENCE,
    );
    expect(first).toBeDefined();
    if (!first) {
      return;
    }

    const second = decodeSpeedCadence(
      first,
      makeData(1536, 4, 3072, 6),
      WHEEL_CIRCUMFERENCE,
    );

    // cadence = 60 * (4 - 2) * 1024 / (1536 - 1024) = 240 rpm
    expect(second?.calculatedCadence).toBe(240);
    // distance = 2.199 * (6 - 4) = 4.398 m
    expect(second?.calculatedDistance).toBeCloseTo(4.398, 10);
    // speed = 4.398 * 1024 / (3072 - 2048) = 4.398 m/s
    expect(second?.calculatedSpeed).toBeCloseTo(4.398, 10);
  });

  it("returns undefined when neither event time changed", () => {
    const state: SpeedCadenceSensorState = { deviceId: 1 };
    const first = decodeSpeedCadence(
      state,
      makeData(1024, 2, 2048, 4),
      WHEEL_CIRCUMFERENCE,
    );
    expect(first).toBeDefined();
    if (!first) {
      return;
    }

    const second = decodeSpeedCadence(
      first,
      makeData(1024, 2, 2048, 4),
      WHEEL_CIRCUMFERENCE,
    );
    expect(second).toBeUndefined();
  });

  it("updates only cadence when the speed event time is unchanged", () => {
    const state: SpeedCadenceSensorState = {
      deviceId: 1,
      cadenceEventTime: 1024,
      cumulativeCadenceRevolutionCount: 2,
      speedEventTime: 2048,
      cumulativeSpeedRevolutionCount: 4,
      calculatedSpeed: 4.398,
      calculatedDistance: 8.796,
    };

    const next = decodeSpeedCadence(
      state,
      makeData(2048, 3, 2048, 4),
      WHEEL_CIRCUMFERENCE,
    );

    // cadence = 60 * (3 - 2) * 1024 / (2048 - 1024) = 60 rpm
    expect(next?.calculatedCadence).toBe(60);
    expect(next?.calculatedSpeed).toBe(4.398);
    expect(next?.calculatedDistance).toBe(8.796);
    expect(next?.speedEventTime).toBe(2048);
    expect(next?.cumulativeSpeedRevolutionCount).toBe(4);
  });

  it("updates only speed when the cadence event time is unchanged", () => {
    const state: SpeedCadenceSensorState = {
      deviceId: 1,
      cadenceEventTime: 1024,
      cumulativeCadenceRevolutionCount: 2,
      speedEventTime: 2048,
      cumulativeSpeedRevolutionCount: 4,
      calculatedCadence: 120,
    };

    const next = decodeSpeedCadence(
      state,
      makeData(1024, 2, 4096, 8),
      WHEEL_CIRCUMFERENCE,
    );

    expect(next?.calculatedCadence).toBe(120);
    expect(next?.cadenceEventTime).toBe(1024);
    // distance = 2.199 * (8 - 4) = 8.796 m
    expect(next?.calculatedDistance).toBeCloseTo(8.796, 10);
    // speed = 8.796 * 1024 / (4096 - 2048) = 4.398 m/s
    expect(next?.calculatedSpeed).toBeCloseTo(4.398, 10);
  });

  it("handles cadence event time and revolution count rollover", () => {
    const state: SpeedCadenceSensorState = {
      deviceId: 1,
      cadenceEventTime: 65000,
      cumulativeCadenceRevolutionCount: 65500,
      speedEventTime: 2048,
      cumulativeSpeedRevolutionCount: 4,
    };

    const next = decodeSpeedCadence(
      state,
      makeData(100, 10, 2048, 4),
      WHEEL_CIRCUMFERENCE,
    );

    // time delta = 100 + 65536 - 65000 = 636
    // count delta = 10 + 65536 - 65500 = 46
    // cadence = 60 * 46 * 1024 / 636
    expect(next?.calculatedCadence).toBeCloseTo((60 * 46 * 1024) / 636, 10);
    // raw (unadjusted) values are stored back into the state
    expect(next?.cadenceEventTime).toBe(100);
    expect(next?.cumulativeCadenceRevolutionCount).toBe(10);
  });

  it("handles speed event time and revolution count rollover", () => {
    const state: SpeedCadenceSensorState = {
      deviceId: 1,
      cadenceEventTime: 1024,
      cumulativeCadenceRevolutionCount: 2,
      speedEventTime: 65535,
      cumulativeSpeedRevolutionCount: 65535,
    };

    const next = decodeSpeedCadence(
      state,
      makeData(1024, 2, 513, 5),
      WHEEL_CIRCUMFERENCE,
    );

    // time delta = 513 + 65536 - 65535 = 514
    // count delta = 5 + 65536 - 65535 = 6
    // distance = 2.199 * 6 = 13.194 m
    expect(next?.calculatedDistance).toBeCloseTo(13.194, 10);
    // speed = 13.194 * 1024 / 514
    expect(next?.calculatedSpeed).toBeCloseTo((13.194 * 1024) / 514, 10);
    // raw (unadjusted) values are stored back into the state
    expect(next?.speedEventTime).toBe(513);
    expect(next?.cumulativeSpeedRevolutionCount).toBe(5);
  });

  it("returns undefined when both calculations yield NaN (all-zero first message)", () => {
    // 0/0 = NaN for both cadence and speed; the legacy code emitted nothing.
    const state: SpeedCadenceSensorState = { deviceId: 1 };
    const next = decodeSpeedCadence(
      state,
      makeData(0, 0, 0, 0),
      WHEEL_CIRCUMFERENCE,
    );
    expect(next).toBeUndefined();
  });

  it("reads the cadence event time as big-endian", () => {
    const view = makeData(0, 1, 2048, 4);
    // Bytes [0x04, 0x00] at the payload start = 0x0400 big-endian.
    view.setUint8(4, 0x04);
    view.setUint8(5, 0x00);

    const state: SpeedCadenceSensorState = { deviceId: 1 };
    const next = decodeSpeedCadence(state, view, WHEEL_CIRCUMFERENCE);
    expect(next?.cadenceEventTime).toBe(0x0400);
  });

  it("does not mutate the input state", () => {
    const state: SpeedCadenceSensorState = { deviceId: 1 };
    decodeSpeedCadence(state, makeData(1024, 2, 2048, 4), WHEEL_CIRCUMFERENCE);
    expect(state).toEqual({ deviceId: 1 });
  });
});
