# web-ant-plus

A package for ANT+ on Web browsers.

[![demo clip](https://user-images.githubusercontent.com/4495546/205473639-220061d6-4f0d-4929-9890-2f3dc28af2c7.png)](https://www.youtube.com/watch?v=3XKP9zcMnw8)

This repository was based on [ant-plus the original module for Node.js](https://github.com/Loghorn/ant-plus) by [@Loghorn](https://github.com/Loghorn).

📝 This package uses the [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API). This API is [not available in some browsers](https://developer.mozilla.org/en-US/docs/Web/API/USB#browser_compatibility).

## Migrating from v2

See [Migrating from v2](docs/migrating-from-v2.md).

## Architecture

See [Architecture](docs/architecture.md).

## How to use

```sh
npm install web-ant-plus
```

### Create a USB driver

```typescript
import { USBDriver } from "web-ant-plus";

// Open the browser pairing dialog (filtered to ANT+ sticks):
const driver = await USBDriver.requestDevice();

// ...or reuse an already paired stick (undefined if none):
const paired = await USBDriver.fromPairedDevice();

// ...or wrap a USBDevice you obtained yourself (no ANT+ check):
const custom = USBDriver.fromDevice(usbDevice);
```

### Open the driver

```typescript
await driver.open(); // resolves once the stick is ready
```

### Create sensors and receive data

```typescript
import { HeartRateSensor } from "web-ant-plus";

const hrSensor = new HeartRateSensor(driver);
hrSensor.on("data", (state) => {
  console.log(state.deviceId, state.computedHeartRate);
});

await hrSensor.attach({ channel: 0, deviceId: 0 }); // deviceId 0 = first device found
```

### Scanning

Scanners receive data from every device of one profile in range:

```typescript
import { HeartRateScanner } from "web-ant-plus";

const hrScanner = new HeartRateScanner(driver);
hrScanner.on("data", (state) => {
  console.log(state.deviceId, state.computedHeartRate, state.rssi);
});

await hrScanner.scan();
```

### Close

```typescript
await driver.close();
```

## Important notes

- never attach a sensor before `driver.open()` has resolved
- attach sensors sequentially (`await` each `attach()` before the next)

## Objects

### USBDriver

Drives ANT+ USB sticks with USB product IDs `0x1008` (Garmin USB2 and many off-brand clones) and `0x1009` (mini Garmin stick).

#### static methods

- `requestDevice()` — opens the browser pairing dialog filtered to supported sticks and resolves with a driver.
- `fromPairedDevice()` — resolves with a driver for the first already-paired stick, or `undefined`.
- `fromDevice(device)` — wraps a `USBDevice` without checking whether it is an ANT+ stick.
- `getPairedDevices()` — resolves with the already-paired ANT+ `USBDevice`s.

#### properties

- `maxChannels` — the maximum number of channels this stick supports; valid only after `open()` resolved.
- `canScan` — whether the stick supports background scanning.

#### methods

- `open()` — opens the device, performs the startup handshake and starts reading in the background. Resolves once sensors can attach.
- `close()` — resets and closes the stick.
- `reset()` — resets the stick and detaches all sensors.

#### events

- `startup` — fired after the stick is correctly initialized.
- `shutdown` — fired after the stick is correctly closed.
- `error` — fired when the background read loop stops due to an error.

### Common to all Sensors

#### methods

- `attach({ channel, deviceId, transmissionType?, timeout? })` — attaches the sensor on the given channel (`deviceId: 0` connects to the first device found). Resolves once the channel is open.
- `detach()` — detaches the sensor.

#### properties

- `state` — the latest decoded state snapshot, if any broadcast has been received.

#### events

- `data` — fired with an immutable state snapshot on every decoded broadcast.
- `attached` / `detached` — fired after the sensor is attached / detached.
- `eventData` — fired for unhandled channel events (`{ message, code }`).

### Common to all Scanners

#### methods

- `scan()` — opens the scanning channel and receives data from every device of the profile in range. Resolves once scanning starts.
- `detach()` — stops scanning.

#### properties

- `states` — a `ReadonlyMap<number, State>` with the latest state per device id.

#### events

- `data`, `attached`, `detached`, `eventData` — as for sensors. Scan states additionally carry `rssi` and `threshold`.

### Profiles

| Profile | Sensor / Scanner | State highlights |
| --- | --- | --- |
| HeartRate | `HeartRateSensor` / `HeartRateScanner` | `computedHeartRate`, `beatCount`, battery pages |
| SpeedCadence | `SpeedCadenceSensor` / `SpeedCadenceScanner` | `calculatedSpeed`, `calculatedCadence`, `calculatedDistance` |
| Speed | `SpeedSensor` / `SpeedScanner` | `calculatedSpeed`, `calculatedDistance` |
| Cadence | `CadenceSensor` / `CadenceScanner` | `calculatedCadence` |
| BicyclePower | `BicyclePowerSensor` / `BicyclePowerScanner` | `power`, `cadence`, `calculatedPower` |
| FitnessEquipment | `FitnessEquipmentSensor` / `FitnessEquipmentScanner` | speed / cadence / power pages, equipment control |
| Environment | `EnvironmentSensor` / `EnvironmentScanner` | `temperature`, `eventCount` |
| MuscleOxygen | `MuscleOxygenSensor` / `MuscleOxygenScanner` | oxygen saturation pages, session commands |
| StrideSpeedDistance | `StrideSpeedDistanceSensor` / `StrideSpeedDistanceScanner` | speed / distance / cadence of a foot pod |

Speed and SpeedCadence expose a `wheelCircumference` property (meters, default `2.199`) used for speed calculation.

FitnessEquipment control commands (all resolve with the acknowledged-transfer result):

```typescript
await feSensor.setBasicResistance(50);
await feSensor.setTargetPower(200);
await feSensor.setUserConfiguration({ userWeight: 70, bikeWeight: 10 });
await feSensor.setWindResistance({ windCoeff: 0.51 });
await feSensor.setTrackResistance({ slope: 2.5 });
```

MuscleOxygen session commands: `setUTCTime()`, `startSession()`, `stopSession()`, `setLap()`.

### Decoders

Every profile also exports its pure decoder (e.g. `decodeHeartRate(state, data, page)`), which turns a raw broadcast `DataView` into the next immutable state — useful for testing and replaying recorded data without any USB hardware.

```text
This software is subject to the ANT+ Shared Source License www.thisisant.com/swlicenses
Copyright (c) Garmin Canada Inc. 2018
All rights reserved.
```
