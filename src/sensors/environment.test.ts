import { describe, expect, it } from "vitest";
import {
  decodeEnvironment,
  type EnvironmentSensorState,
} from "./environment.js";

/**
 * Builds a raw broadcast message: [0xa4, len, msgType, channel, ...payload].
 * The decoder reads the 8-byte payload from BUFFER_INDEX_MSG_DATA (4).
 */
function buildMessage(payload: readonly number[]): DataView {
  const buffer = new Uint8Array([0xa4, payload.length, 0x4e, 0, ...payload]);
  return new DataView(buffer.buffer);
}

describe("decodeEnvironment", () => {
  const initialState: EnvironmentSensorState = { deviceId: 1234 };

  it("decodes event count and temperature from page 1", () => {
    // Temperature raw = 2534 (0x09e6, little-endian) -> 25.34 degrees C.
    const data = buildMessage([1, 0, 42, 0, 0, 0, 0xe6, 0x09]);

    const next = decodeEnvironment(initialState, data);

    expect(next.eventCount).toBe(42);
    expect(next.temperature).toBe(25.34);
    expect(next.receivedAt).toBeTypeOf("number");
    expect(next.deviceId).toBe(1234);
  });

  it("decodes a raw value with the sign bit set as unsigned (legacy behavior)", () => {
    // Raw bytes 0x30 0xf8 (little-endian) = 0xf830 = 63536. The legacy
    // decoder reads this with getUint16, so it yields 635.36 rather than
    // interpreting it as the signed value -2000 (-20.00 degrees C).
    const data = buildMessage([1, 0, 7, 0, 0, 0, 0x30, 0xf8]);

    const next = decodeEnvironment(initialState, data);

    expect(next.temperature).toBe(635.36);
  });

  it("decodes a zero temperature", () => {
    const data = buildMessage([1, 0, 0, 0, 0, 0, 0x00, 0x00]);

    const next = decodeEnvironment(initialState, data);

    expect(next.eventCount).toBe(0);
    expect(next.temperature).toBe(0);
  });

  it("keeps previous values and only updates receivedAt on other pages", () => {
    const state: EnvironmentSensorState = {
      deviceId: 1234,
      eventCount: 42,
      temperature: 25.34,
    };
    const data = buildMessage([0, 0, 99, 0, 0, 0, 0xff, 0xff]);

    const next = decodeEnvironment(state, data);

    expect(next.eventCount).toBe(42);
    expect(next.temperature).toBe(25.34);
    expect(next.receivedAt).toBeTypeOf("number");
  });

  it("does not mutate the input state", () => {
    const data = buildMessage([1, 0, 42, 0, 0, 0, 0xe6, 0x09]);

    decodeEnvironment(initialState, data);

    expect(initialState).toEqual({ deviceId: 1234 });
  });
});
