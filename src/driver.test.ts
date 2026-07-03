import { afterEach, describe, expect, it } from "vitest";
import { type ChannelParticipant, USBDriver } from "./driver.js";
import * as messages from "./messages.js";
import {
  FakeUSB,
  FakeUSBDevice,
  type HandshakeOptions,
  installFakeUsb,
} from "./testing/fakeUsb.js";

let restoreNavigator: (() => void) | undefined;

afterEach(() => {
  restoreNavigator?.();
  restoreNavigator = undefined;
});

function installDevices(devices: readonly FakeUSBDevice[]): void {
  restoreNavigator = installFakeUsb(new FakeUSB(devices));
}

async function openDriver(
  options?: HandshakeOptions,
): Promise<{ device: FakeUSBDevice; driver: USBDriver }> {
  const device = new FakeUSBDevice();
  device.respondToHandshake(options);
  const driver = USBDriver.fromDevice(device.asDevice());
  await driver.open();
  return { device, driver };
}

function fakeSensor(): ChannelParticipant {
  return { detach: async () => {} };
}

describe("USBDriver.getPairedDevices", () => {
  it("returns only devices matching both vendor and product id", async () => {
    // Regression: the legacy v2 filter was mis-parenthesized and accepted
    // any device with productId 0x1009, regardless of vendor.
    installDevices([
      new FakeUSBDevice(0x0fcf, 0x1008),
      new FakeUSBDevice(0x0fcf, 0x1009),
      new FakeUSBDevice(0x1234, 0x1009),
      new FakeUSBDevice(0x0fcf, 0x9999),
    ]);

    const paired = await USBDriver.getPairedDevices();

    expect(paired.map((device) => [device.vendorId, device.productId])).toEqual(
      [
        [0x0fcf, 0x1008],
        [0x0fcf, 0x1009],
      ],
    );
  });
});

describe("USBDriver.open", () => {
  it("resolves after the handshake and applies the capabilities frame", async () => {
    const { device, driver } = await openDriver({
      maxChannels: 4,
      canScan: true,
    });

    expect(driver.maxChannels).toBe(4);
    expect(driver.canScan).toBe(true);
    // reset -> capabilities request -> network key
    expect(device.sentMessageIds).toEqual([0x4a, 0x4d, 0x46]);
  });

  it("reports canScan false when the capabilities bits are unset", async () => {
    const { driver } = await openDriver({ maxChannels: 8, canScan: false });

    expect(driver.maxChannels).toBe(8);
    expect(driver.canScan).toBe(false);
  });
});

describe("channel bookkeeping", () => {
  it("attach succeeds up to maxChannels and detach frees a slot", async () => {
    const { driver } = await openDriver({ maxChannels: 2 });
    const first = fakeSensor();
    const second = fakeSensor();
    const third = fakeSensor();

    expect(driver.attach(first, false)).toBe(true);
    expect(driver.attach(second, false)).toBe(true);
    expect(driver.attach(third, false)).toBe(false);

    expect(driver.detach(second)).toBe(true);
    expect(driver.attach(third, false)).toBe(true);
  });

  it("scan attach only succeeds when no channels are in use", async () => {
    const { driver } = await openDriver({ maxChannels: 2 });
    const regular = fakeSensor();
    const scanner = fakeSensor();

    expect(driver.attach(regular, false)).toBe(true);
    expect(driver.attach(scanner, true)).toBe(false);

    expect(driver.detach(regular)).toBe(true);
    expect(driver.attach(scanner, true)).toBe(true);
    expect(driver.isScanning()).toBe(true);
    expect(driver.attach(regular, false)).toBe(false);

    expect(driver.detach(scanner)).toBe(true);
    expect(driver.isScanning()).toBe(false);
    expect(driver.attach(regular, false)).toBe(true);
  });

  it("detach returns false for a sensor that was never attached", async () => {
    const { driver } = await openDriver({ maxChannels: 2 });

    expect(driver.detach(fakeSensor())).toBe(false);
  });
});

describe("USBDriver.write", () => {
  it("sends the exact frame bytes to the out endpoint", async () => {
    const { device, driver } = await openDriver();

    await driver.write(messages.openChannel(0));

    expect(Array.from(device.sentMessages.at(-1) ?? [])).toEqual([
      0xa4, 0x01, 0x4b, 0x00, 0xee,
    ]);
  });
});

describe("read loop", () => {
  it("emits a queued broadcast frame via the read event", async () => {
    const { device, driver } = await openDriver();
    const read = new Promise<DataView>((resolve) => {
      driver.once("read", resolve);
    });

    device.queueResponse(messages.broadcastData(0, [1, 2, 3, 4, 5, 6, 7, 8]));

    const data = await read;
    expect(Array.from(new Uint8Array(data.buffer))).toEqual([
      0xa4, 0x09, 0x4e, 0x00, 1, 2, 3, 4, 5, 6, 7, 8, 0xeb,
    ]);
  });
});
