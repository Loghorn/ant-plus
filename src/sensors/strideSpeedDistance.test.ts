import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Constants } from "../constants.js";
import {
  decodeStrideSpeedDistance,
  type StrideSpeedDistanceSensorState,
} from "./strideSpeedDistance.js";

const NOW = 1_700_000_000_000;

/**
 * Builds a raw broadcast message: [sync, len, msgType, channel, ...payload].
 * The payload starts at BUFFER_INDEX_MSG_DATA (4).
 */
function buildMessage(payload: number[]): DataView {
  const raw = [
    0xa4,
    payload.length + 1,
    Constants.MESSAGE_CHANNEL_BROADCAST_DATA,
    0,
    ...payload,
  ];
  return new DataView(Uint8Array.from(raw).buffer);
}

describe("decodeStrideSpeedDistance", () => {
  const initialState: StrideSpeedDistanceSensorState = { deviceId: 12345 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("decodes page 1 (time, distance, speed, strides, latency)", () => {
    // Byte 4 = 0xd3: distanceFractional = 0xd3 >>> 4 = 13,
    // speedInteger = 0xd3 & 0x0f = 3.
    const data = buildMessage([0x01, 0x80, 0x05, 0x2a, 0xd3, 0x40, 0x0c, 0x07]);

    const next = decodeStrideSpeedDistance(initialState, data);

    expect(next).toEqual({
      deviceId: 12345,
      timeFractional: 0x80,
      timeInteger: 0x05,
      distanceInteger: 0x2a,
      distanceFractional: 13,
      speedInteger: 3,
      speedFractional: 0x40,
      strideCount: 0x0c,
      updateLatency: 0x07,
      receivedAt: NOW,
    });
  });

  it("decodes page 2 (cadence, speed, status) without calories", () => {
    // Byte 4 = 0x72: cadenceFractional = 0x72 >>> 4 = 7,
    // speedInteger = 0x72 & 0x0f = 2.
    const data = buildMessage([0x02, 0xff, 0xff, 0xb4, 0x72, 0x19, 0x00, 0x01]);

    const next = decodeStrideSpeedDistance(initialState, data);

    expect(next).toEqual({
      deviceId: 12345,
      cadenceInteger: 0xb4,
      cadenceFractional: 7,
      speedInteger: 2,
      speedFractional: 0x19,
      status: 0x01,
      receivedAt: NOW,
    });
    expect(next.calories).toBeUndefined();
  });

  it("decodes page 3 including calories", () => {
    // Byte 4 = 0x21: cadenceFractional = 2, speedInteger = 1.
    const data = buildMessage([0x03, 0x00, 0x00, 0x5a, 0x21, 0x0a, 0x64, 0x03]);

    const next = decodeStrideSpeedDistance(initialState, data);

    expect(next).toEqual({
      deviceId: 12345,
      cadenceInteger: 0x5a,
      cadenceFractional: 2,
      speedInteger: 1,
      speedFractional: 0x0a,
      status: 0x03,
      calories: 0x64,
      receivedAt: NOW,
    });
  });

  it("decodes page 15 as a common page (upper bound of 2..15)", () => {
    const data = buildMessage([0x0f, 0x00, 0x00, 0x50, 0x34, 0x02, 0x99, 0x02]);

    const next = decodeStrideSpeedDistance(initialState, data);

    expect(next).toEqual({
      deviceId: 12345,
      cadenceInteger: 0x50,
      cadenceFractional: 3,
      speedInteger: 4,
      speedFractional: 0x02,
      status: 0x02,
      receivedAt: NOW,
    });
    expect(next.calories).toBeUndefined();
  });

  it("updates only receivedAt for pages outside 1..15", () => {
    const data = buildMessage([0x10, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);

    const next = decodeStrideSpeedDistance(initialState, data);

    expect(next).toEqual({ deviceId: 12345, receivedAt: NOW });
  });

  it("preserves fields from earlier pages and does not mutate the input", () => {
    const page1 = buildMessage([
      0x01, 0x80, 0x05, 0x2a, 0xd3, 0x40, 0x0c, 0x07,
    ]);
    const page3 = buildMessage([
      0x03, 0x00, 0x00, 0x5a, 0x21, 0x0a, 0x64, 0x03,
    ]);

    const afterPage1 = decodeStrideSpeedDistance(initialState, page1);
    const afterPage3 = decodeStrideSpeedDistance(afterPage1, page3);

    // Page 1 fields survive a page 3 update.
    expect(afterPage3.timeInteger).toBe(0x05);
    expect(afterPage3.distanceInteger).toBe(0x2a);
    expect(afterPage3.strideCount).toBe(0x0c);
    // Page 3 overwrites the shared speed fields.
    expect(afterPage3.speedInteger).toBe(1);
    expect(afterPage3.speedFractional).toBe(0x0a);
    // Purity: inputs are untouched.
    expect(initialState).toEqual({ deviceId: 12345 });
    expect(afterPage1.cadenceInteger).toBeUndefined();
  });
});
