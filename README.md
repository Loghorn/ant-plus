# web-ant-plus

A package for ANT+ on Web browsers.

[![demo clip](https://user-images.githubusercontent.com/4495546/205473639-220061d6-4f0d-4929-9890-2f3dc28af2c7.png)](https://www.youtube.com/watch?v=3XKP9zcMnw8)

This repository was based on [ant-plus the original module for Node.js](https://github.com/Loghorn/ant-plus) by [@Loghorn](https://github.com/Loghorn).

📝 This package uses the [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API). This API is [not available in some browsers](https://developer.mozilla.org/en-US/docs/Web/API/USB#browser_compatibility).

## How to use

```sh
npm install web-ant-plus
```

#### Create USB stick GarminStick2 or GarminStick3

```typescript
import { GarminStick3 } from 'web-ant-plus';
const stick = new GarminStick3();
```

#### Create sensors

```typescript
const hrSensor = new HeartRateSensor(stick);
```

#### Attach events

```typescript
hrSensor.on('hbData', function (data: HeartRateSensorState) {
  console.log(data.DeviceID, data.ComputedHeartRate);
});

stick.on('startup', function () {
  hrSensor.attach(0, 0);
});
```

#### Open stick

```typescript
if (!stick.open()) {
  console.log('Stick not found!');
}
```

### scanning

```typescript
const hrScanner = new HeartRateScanner(stick);

hrScanner.on('hbData', function (data: HeartRateSensorState) {
  console.log(data.DeviceID, data.ComputedHeartRate);
});

stick.on('startup', function () {
  hrScanner.scan();
});

if (!stick.open()) {
  console.log('Stick not found!');
}
```

## Important notes

- never attach a sensor before receiving the startup event
- never attach a new sensor before receiving the attached or detached event of the previous sensor
- never detach a sensor before receiving the attached or detached event of the previous sensor

## Objects

### GarminStick2 and GarminStick3

GarminStick2 is the driver for ANT+ sticks with a USB product ID of `0x1008`.
As well as the old Garmin USB2 ANT+ stick, this works with many of the common off-brand clones.

GarminStick3 is the driver for the mini Garmin ANT+ stick
which has a USB product ID of `0x1009`.

#### properties

- maxChannels

  - The maximum number of channels that this stick supports; valid only after startup event fired.

#### methods

- is_present()

  - Checks if the stick is present. Returns true if it is, false otherwise.

- open()

  - Tries to open the stick. Returns false on failure.

- close()

  - Closes the stick.

- reset()

  - Reset the stick and detach all sensors;

#### events

- startup

  - Fired after the stick is correctly initialized.

- shutdown

  - Fired after the stick is correctly closed.

### Common to all Sensors

#### methods

- attach(channel: number, deviceID: number)

  - Attaches the sensors, using the specified channel and deviceId (use 0 to connect to the first device found).

- detach()

  - Detaches the sensor.

#### events

- attached

  - Fired after the sensor is correctly attached.

- detached

  - Fired after the sensor is correctly detached.

### Common to all Scanners

#### methods

- scan()

  - Attaches the sensors and starts scanning for data from every devices in range.

- detach()

  - Detaches the sensor.

#### events

- attached

  - Fired after the sensor is correctly attached.

- detached

  - Fired after the sensor is correctly detached.

### HeartRate

#### events

- hbData

  - Fired when new heartbeat data is received.

### SpeedCadence

#### methods

#### setWheelCircumference(circumferenceInMeters)

Calibrates the speed sensor. Defaults to a wheel with diameter of 70cm (= 2.199).

#### events

- speedData

  - Fired when a new wheel speed is calculated.

- cadenceData

  - Fired when a new pedal cadence is calculated.

### StrideSpeedDistance

#### events

- ssdData

  - Fired when new data been calculated.

### BicyclePower

#### events

- powerData

  - Fired when new power has been calculated.

### FitnessEquipment

#### events

- fitnessData

  - Fired when new data is received.

### Environment

#### events

- envData

  - Fired when data is received.
  - The `state.EventCount` value can be used to tell when a new measurement has been made by the sensor -
    it's value will have been incremented.

```
This software is subject to the ANT+ Shared Source License www.thisisant.com/swlicenses
Copyright (c) Garmin Canada Inc. 2018
All rights reserved.
```
