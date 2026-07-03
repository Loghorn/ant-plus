import { describe, expect, it } from "vitest";
import * as messages from "./messages.js";

function toBytes(message: DataView): number[] {
  return Array.from(
    new Uint8Array(message.buffer, message.byteOffset, message.byteLength),
  );
}

// Wire format: [0xa4 sync, payload length, message id, ...payload, checksum].
// The checksum is the XOR of all preceding bytes, each step taken % 0xff.

describe("getChecksum", () => {
  it("XORs all bytes", () => {
    // 0xa4 ^ 0x01 = 0xa5, ^ 0x4a = 0xef, ^ 0x00 = 0xef
    expect(messages.getChecksum([0xa4, 0x01, 0x4a, 0x00])).toBe(0xef);
  });

  it("reduces an intermediate 0xff to 0 via the modulo", () => {
    expect(messages.getChecksum([0xff])).toBe(0x00);
  });
});

describe("buildMessage", () => {
  it("frames the payload with sync, length, id and checksum", () => {
    expect(toBytes(messages.buildMessage([0x00], 0x4a))).toEqual([
      0xa4, 0x01, 0x4a, 0x00, 0xef,
    ]);
  });
});

describe("intToLEByteArray", () => {
  it("encodes little-endian bytes of the requested width", () => {
    expect(messages.intToLEByteArray(0x1f86, 2)).toEqual([0x86, 0x1f]);
  });
});

describe("assignChannel", () => {
  it("defaults to a two-way receive channel (type 0x00)", () => {
    // 0xa4 ^ 0x03 = 0xa7, ^ 0x42 = 0xe5
    expect(toBytes(messages.assignChannel(0))).toEqual([
      0xa4, 0x03, 0x42, 0x00, 0x00, 0x00, 0xe5,
    ]);
  });

  it("encodes a transmit channel (type 0x10)", () => {
    // 0xe5 ^ 0x01 = 0xe4, ^ 0x10 = 0xf4
    expect(toBytes(messages.assignChannel(1, "transmit"))).toEqual([
      0xa4, 0x03, 0x42, 0x01, 0x10, 0x00, 0xf4,
    ]);
  });

  it("encodes a receive-only channel (type 0x40)", () => {
    // 0xe5 ^ 0x40 = 0xa5
    expect(toBytes(messages.assignChannel(0, "receive_only"))).toEqual([
      0xa4, 0x03, 0x42, 0x00, 0x40, 0x00, 0xa5,
    ]);
  });
});

describe("setDevice", () => {
  it("encodes the device id as two little-endian bytes", () => {
    // deviceId 12345 = 0x3039 -> [0x39, 0x30]
    // 0xa4 ^ 0x05 = 0xa1, ^ 0x51 = 0xf0, ^ 0x00 = 0xf0, ^ 0x39 = 0xc9,
    // ^ 0x30 = 0xf9, ^ 0x78 = 0x81, ^ 0x00 = 0x81
    expect(toBytes(messages.setDevice(0, 12345, 0x78, 0))).toEqual([
      0xa4, 0x05, 0x51, 0x00, 0x39, 0x30, 0x78, 0x00, 0x81,
    ]);
  });
});

describe("setPeriod", () => {
  it("encodes period 8070 as [0x00, 0x86, 0x1f]", () => {
    // 8070 = 0x1f86, little-endian -> [0x86, 0x1f]
    // 0xa4 ^ 0x03 = 0xa7, ^ 0x43 = 0xe4, ^ 0x00 = 0xe4, ^ 0x86 = 0x62,
    // ^ 0x1f = 0x7d
    expect(toBytes(messages.setPeriod(0, 8070))).toEqual([
      0xa4, 0x03, 0x43, 0x00, 0x86, 0x1f, 0x7d,
    ]);
  });
});

describe("searchChannel", () => {
  it("encodes the channel and timeout", () => {
    // 0xa4 ^ 0x02 = 0xa6, ^ 0x44 = 0xe2, ^ 0x00 = 0xe2, ^ 0x0a = 0xe8
    expect(toBytes(messages.searchChannel(0, 10))).toEqual([
      0xa4, 0x02, 0x44, 0x00, 0x0a, 0xe8,
    ]);
  });
});

describe("setFrequency", () => {
  it("encodes the channel and frequency", () => {
    // 0xa4 ^ 0x02 = 0xa6, ^ 0x45 = 0xe3, ^ 0x00 = 0xe3, ^ 0x39 = 0xda
    expect(toBytes(messages.setFrequency(0, 57))).toEqual([
      0xa4, 0x02, 0x45, 0x00, 0x39, 0xda,
    ]);
  });
});

describe("single-byte channel commands", () => {
  it("openChannel", () => {
    // 0xa4 ^ 0x01 = 0xa5, ^ 0x4b = 0xee, ^ 0x00 = 0xee
    expect(toBytes(messages.openChannel(0))).toEqual([
      0xa4, 0x01, 0x4b, 0x00, 0xee,
    ]);
  });

  it("closeChannel", () => {
    // 0xa5 ^ 0x4c = 0xe9
    expect(toBytes(messages.closeChannel(0))).toEqual([
      0xa4, 0x01, 0x4c, 0x00, 0xe9,
    ]);
  });

  it("unassignChannel", () => {
    // 0xa5 ^ 0x41 = 0xe4
    expect(toBytes(messages.unassignChannel(0))).toEqual([
      0xa4, 0x01, 0x41, 0x00, 0xe4,
    ]);
  });
});

describe("acknowledgedData", () => {
  it("frames the channel and payload", () => {
    // 0xa4 ^ 0x09 = 0xad, ^ 0x4f = 0xe2, ^ 0x00 = 0xe2, then
    // ^ 1..8 in sequence = 0xea
    expect(
      toBytes(messages.acknowledgedData(0, [1, 2, 3, 4, 5, 6, 7, 8])),
    ).toEqual([0xa4, 0x09, 0x4f, 0x00, 1, 2, 3, 4, 5, 6, 7, 8, 0xea]);
  });
});
