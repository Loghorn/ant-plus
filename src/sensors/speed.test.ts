import { describe, expect, it } from "vitest";
import { decodeSpeed, type SpeedSensorState } from "./speed.js";

const WHEEL_CIRCUMFERENCE = 2.199;

/**
 * Builds a raw broadcast message: [0xa4, len, msgType, channel, ...payload]
 * so the 8 byte page payload starts at BUFFER_INDEX_MSG_DATA (4).
 */
function buildData(payload: number[]): DataView {
  const raw = [0xa4, payload.length, 0x4e, 0x00, ...payload];
  return new DataView(new Uint8Array(raw).buffer);
}

function speedPayload(
  page: number,
  b1: number,
  b2: number,
  b3: number,
  eventTime: number,
  revCount: number,
): number[] {
  return [
    page,
    b1,
    b2,
    b3,
    eventTime & 0xff,
    (eventTime >> 8) & 0xff,
    revCount & 0xff,
    (revCount >> 8) & 0xff,
  ];
}

describe("decodeSpeed", () => {
  it("calculates speed and distance from consecutive events", () => {
    const state: SpeedSensorState = {
      deviceId: 12345,
      speedEventTime: 1024,
      cumulativeSpeedRevolutionCount: 2,
    };
    // 2 revolutions in 1024 ticks (1 second).
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 2048, 4));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    // distance = 2.199 * (4 - 2) = 4.398 m
    // speed = 4.398 * 1024 / (2048 - 1024) = 4.398 m/s
    expect(next).toBeDefined();
    expect(next?.speedEventTime).toBe(2048);
    expect(next?.cumulativeSpeedRevolutionCount).toBe(4);
    expect(next?.calculatedDistance).toBeCloseTo(4.398, 10);
    expect(next?.calculatedSpeed).toBeCloseTo(4.398, 10);
    expect(next?.receivedAt).toBeTypeOf("number");
  });

  it("treats missing previous values as zero on the first event", () => {
    const state: SpeedSensorState = { deviceId: 12345 };
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 1024, 2));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    // distance = 2.199 * (2 - 0) = 4.398 m; speed = 4.398 * 1024 / 1024
    expect(next?.calculatedDistance).toBeCloseTo(4.398, 10);
    expect(next?.calculatedSpeed).toBeCloseTo(4.398, 10);
  });

  it("handles event time rollover", () => {
    const state: SpeedSensorState = {
      deviceId: 12345,
      speedEventTime: 65000,
      cumulativeSpeedRevolutionCount: 100,
    };
    // Time wrapped: 65000 -> 232 means 65536 + 232 - 65000 = 768 ticks.
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 232, 103));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    // distance = 2.199 * 3 = 6.597 m; speed = 6.597 * 1024 / 768 = 8.796 m/s
    expect(next?.calculatedDistance).toBeCloseTo(6.597, 10);
    expect(next?.calculatedSpeed).toBeCloseTo(8.796, 10);
    // Raw (unadjusted) values are stored back on the state.
    expect(next?.speedEventTime).toBe(232);
    expect(next?.cumulativeSpeedRevolutionCount).toBe(103);
  });

  it("handles revolution count rollover", () => {
    const state: SpeedSensorState = {
      deviceId: 12345,
      speedEventTime: 1000,
      cumulativeSpeedRevolutionCount: 65500,
    };
    // Count wrapped: 65500 -> 4 means 65536 + 4 - 65500 = 40 revolutions.
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 2024, 4));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    // distance = 2.199 * 40 = 87.96 m; speed = 87.96 * 1024 / 1024
    expect(next?.calculatedDistance).toBeCloseTo(87.96, 10);
    expect(next?.calculatedSpeed).toBeCloseTo(87.96, 10);
    expect(next?.cumulativeSpeedRevolutionCount).toBe(4);
  });

  it("uses the given wheel circumference", () => {
    const state: SpeedSensorState = {
      deviceId: 12345,
      speedEventTime: 1024,
      cumulativeSpeedRevolutionCount: 10,
    };
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 2048, 15));

    const next = decodeSpeed(state, data, 2.0);

    // distance = 2.0 * 5 = 10 m; speed = 10 * 1024 / 1024 = 10 m/s
    expect(next?.calculatedDistance).toBeCloseTo(10, 10);
    expect(next?.calculatedSpeed).toBeCloseTo(10, 10);
  });

  it("returns undefined when the event time has not changed", () => {
    const state: SpeedSensorState = {
      deviceId: 12345,
      speedEventTime: 2048,
      cumulativeSpeedRevolutionCount: 4,
    };
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 2048, 4));

    expect(decodeSpeed(state, data, WHEEL_CIRCUMFERENCE)).toBeUndefined();
  });

  it("returns undefined when the computed speed is NaN", () => {
    const state: SpeedSensorState = { deviceId: 12345 };
    // Event time 0 with no previous event: 0 / 0 = NaN.
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 0, 0));

    expect(decodeSpeed(state, data, WHEEL_CIRCUMFERENCE)).toBeUndefined();
  });

  it("does not mutate the previous state", () => {
    const state: SpeedSensorState = {
      deviceId: 12345,
      speedEventTime: 1024,
      cumulativeSpeedRevolutionCount: 2,
    };
    const data = buildData(speedPayload(0, 0xff, 0xff, 0xff, 2048, 4));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    expect(next).not.toBe(state);
    expect(state).toEqual({
      deviceId: 12345,
      speedEventTime: 1024,
      cumulativeSpeedRevolutionCount: 2,
    });
  });

  it("decodes cumulative operating time from page 1", () => {
    const state: SpeedSensorState = { deviceId: 12345 };
    // Operating time bytes: 0x10 | 0x20 << 8 | 0x03 << 16 = 204816; * 2s.
    const data = buildData(speedPayload(1, 0x10, 0x20, 0x03, 1024, 2));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    expect(next?.operatingTime).toBe(409632);
  });

  it("decodes manufacturer id and serial number from page 2", () => {
    const state: SpeedSensorState = { deviceId: 0x3039 };
    // Serial = deviceId | uint16le(0xbeef) << 16 = 0xbeef3039.
    const data = buildData(speedPayload(2, 0x7f, 0xef, 0xbe, 1024, 2));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    expect(next?.manId).toBe(0x7f);
    expect(next?.serialNumber).toBe(0xbeef3039);
  });

  it("decodes battery information from page 4, ignoring the toggle bit", () => {
    const state: SpeedSensorState = { deviceId: 12345 };
    // Page 0x84 = page 4 with toggle bit. Status 0x33: flags 3 (Ok),
    // coarse voltage 3 + 128/256 = 3.5 V.
    const data = buildData(speedPayload(0x84, 0xff, 0x80, 0x33, 1024, 2));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    expect(next?.batteryStatus).toBe("Ok");
    expect(next?.batteryVoltage).toBeCloseTo(3.5, 10);
  });

  it("decodes stop indication from page 5", () => {
    const state: SpeedSensorState = { deviceId: 12345 };
    const data = buildData(speedPayload(5, 0x01, 0x00, 0x00, 1024, 2));

    const next = decodeSpeed(state, data, WHEEL_CIRCUMFERENCE);

    expect(next?.motion).toBe(true);
  });
});
