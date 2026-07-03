import { describe, expect, it } from "vitest";
import { type CadenceSensorState, decodeCadence } from "./cadence.js";

/**
 * Builds a raw broadcast message: [sync, len, msgType, channel, ...payload]
 * so the payload starts at BUFFER_INDEX_MSG_DATA (4).
 */
function makeMessage(payload: number[]): DataView {
  return new DataView(
    new Uint8Array([0xa4, payload.length, 0x4e, 0x00, ...payload]).buffer,
  );
}

/**
 * Builds an 8 byte cadence page payload. The last four bytes of every
 * page carry the event time and revolution count (little endian).
 */
function makePage(
  pageNum: number,
  bytes: [number, number, number],
  cadenceTime: number,
  cadenceCount: number,
): DataView {
  return makeMessage([
    pageNum,
    ...bytes,
    cadenceTime & 0xff,
    (cadenceTime >> 8) & 0xff,
    cadenceCount & 0xff,
    (cadenceCount >> 8) & 0xff,
  ]);
}

const initialState: CadenceSensorState = { deviceId: 12345 };

describe("decodeCadence", () => {
  it("decodes the first broadcast against an empty state", () => {
    const next = decodeCadence(
      initialState,
      makePage(0, [0xff, 0xff, 0xff], 512, 10),
    );

    expect(next.cadenceEventTime).toBe(512);
    expect(next.cumulativeCadenceRevolutionCount).toBe(10);
    // 60 * (10 - 0) * 1024 / (512 - 0)
    expect(next.calculatedCadence).toBe(1200);
    expect(next.receivedAt).toBeTypeOf("number");
    expect(next.deviceId).toBe(12345);
  });

  it("computes cadence from the delta of two broadcasts", () => {
    const first = decodeCadence(
      initialState,
      makePage(0, [0xff, 0xff, 0xff], 512, 10),
    );
    const next = decodeCadence(
      first,
      makePage(0, [0xff, 0xff, 0xff], 1536, 20),
    );

    expect(next.cadenceEventTime).toBe(1536);
    expect(next.cumulativeCadenceRevolutionCount).toBe(20);
    // 60 * (20 - 10) * 1024 / (1536 - 512)
    expect(next.calculatedCadence).toBe(600);
  });

  it("handles event time and revolution count rollover", () => {
    const state: CadenceSensorState = {
      ...initialState,
      cadenceEventTime: 65024,
      cumulativeCadenceRevolutionCount: 65530,
    };
    const next = decodeCadence(state, makePage(0, [0xff, 0xff, 0xff], 512, 4));

    // Raw (wrapped) values are stored on the state.
    expect(next.cadenceEventTime).toBe(512);
    expect(next.cumulativeCadenceRevolutionCount).toBe(4);
    // 60 * ((4 + 65536) - 65530) * 1024 / ((512 + 65536) - 65024)
    expect(next.calculatedCadence).toBe(600);
  });

  it("keeps the previous cadence when the event time is unchanged", () => {
    const state: CadenceSensorState = {
      ...initialState,
      cadenceEventTime: 512,
      cumulativeCadenceRevolutionCount: 10,
      calculatedCadence: 1200,
    };
    const next = decodeCadence(state, makePage(0, [0xff, 0xff, 0xff], 512, 10));

    expect(next.cadenceEventTime).toBe(512);
    expect(next.cumulativeCadenceRevolutionCount).toBe(10);
    expect(next.calculatedCadence).toBe(1200);
    expect(next.receivedAt).toBeTypeOf("number");
  });

  it("does not mutate the previous state", () => {
    const next = decodeCadence(
      initialState,
      makePage(0, [0xff, 0xff, 0xff], 512, 10),
    );

    expect(next).not.toBe(initialState);
    expect(initialState).toEqual({ deviceId: 12345 });
  });

  it("decodes page 1 cumulative operating time", () => {
    const next = decodeCadence(
      initialState,
      makePage(1, [0x10, 0x20, 0x03], 512, 10),
    );

    // (0x032010) * 2
    expect(next.operatingTime).toBe(409632);
  });

  it("decodes page 1 with the page toggle bit set", () => {
    const next = decodeCadence(
      initialState,
      makePage(0x81, [0x10, 0x20, 0x03], 512, 10),
    );

    expect(next.operatingTime).toBe(409632);
  });

  it("decodes page 2 manufacturer id and serial number", () => {
    const next = decodeCadence(
      initialState,
      makePage(2, [0x0f, 0xef, 0xbe], 512, 10),
    );

    expect(next.manId).toBe(0x0f);
    // (12345 | (0xbeef << 16)) >>> 0
    expect(next.serialNumber).toBe(0xbeef3039);
  });

  it("decodes page 3 hardware, software and model", () => {
    const next = decodeCadence(
      initialState,
      makePage(3, [0x01, 0x02, 0x03], 512, 10),
    );

    expect(next.hwVersion).toBe(1);
    expect(next.swVersion).toBe(2);
    expect(next.modelNum).toBe(3);
  });

  it("decodes page 4 battery voltage and status", () => {
    const next = decodeCadence(
      initialState,
      makePage(4, [0x00, 0x80, 0x23], 512, 10),
    );

    // (0x23 & 0x0f) + 0x80 / 256
    expect(next.batteryVoltage).toBe(3.5);
    expect(next.batteryStatus).toBe("Good");
  });

  it("decodes page 4 with an invalid battery flag", () => {
    const next = decodeCadence(
      initialState,
      makePage(4, [0x00, 0x80, 0x03], 512, 10),
    );

    expect(next.batteryVoltage).toBeUndefined();
    expect(next.batteryStatus).toBe("Invalid");
  });

  it("decodes page 5 motion flag", () => {
    const stopped = decodeCadence(
      initialState,
      makePage(5, [0x01, 0x00, 0x00], 512, 10),
    );
    expect(stopped.motion).toBe(true);

    const moving = decodeCadence(
      initialState,
      makePage(5, [0x00, 0x00, 0x00], 512, 10),
    );
    expect(moving.motion).toBe(false);
  });
});
