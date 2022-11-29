/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed/
 */

import { Messages } from '../Messages';

export class SpeedSensorState {
  constructor(deviceID: number) {
    this.DeviceID = deviceID;
  }

  DeviceID: number;

  SpeedEventTime?: number;

  CumulativeSpeedRevolutionCount?: number;

  CalculatedDistance?: number;

  CalculatedSpeed?: number;

  OperatingTime?: number;

  ManId?: number;

  SerialNumber?: number;

  HwVersion?: number;

  SwVersion?: number;

  ModelNum?: number;

  BatteryVoltage?: number;

  BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';

  Motion?: boolean;

  updateState(
    data: DataView,
    wheelCircumference: number
  ): SpeedSensorState | undefined {
    const TOGGLE_MASK = 0x80;

    const pageNum = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA);
    switch (
      pageNum & ~TOGGLE_MASK // check the new pages and remove the toggle bit
    ) {
      case 1:
        // decode the cumulative operating time
        this.OperatingTime = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        this.OperatingTime |=
          data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2) << 8;
        this.OperatingTime |=
          data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 16;
        this.OperatingTime *= 2;
        break;
      case 2:
        // decode the Manufacturer ID
        this.ManId = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        // decode the 4 byte serial number
        this.SerialNumber = this.DeviceID;
        this.SerialNumber |=
          data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 2, true) << 16;
        this.SerialNumber >>>= 0;
        break;
      case 3:
        // decode HW version, SW version, and model number
        this.HwVersion = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        this.SwVersion = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        this.ModelNum = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        break;
      case 4: {
        const batteryFrac = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        const batteryStatus = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        this.BatteryVoltage = (batteryStatus & 0x0f) + batteryFrac / 256;
        const batteryFlags = (batteryStatus & 0x70) >>> 4;
        switch (batteryFlags) {
          case 1:
            this.BatteryStatus = 'New';
            break;
          case 2:
            this.BatteryStatus = 'Good';
            break;
          case 3:
            this.BatteryStatus = 'Ok';
            break;
          case 4:
            this.BatteryStatus = 'Low';
            break;
          case 5:
            this.BatteryStatus = 'Critical';
            break;
          default:
            this.BatteryVoltage = undefined;
            this.BatteryStatus = 'Invalid';
            break;
        }
        break;
      }
      case 5:
        this.Motion =
          (data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1) & 0x01) === 0x01;
        break;
      default:
        break;
    }

    // get old state for calculating cumulative values
    const oldSpeedTime = this.SpeedEventTime;
    const oldSpeedCount = this.CumulativeSpeedRevolutionCount;

    let speedEventTime = data.getUint16(
      Messages.BUFFER_INDEX_MSG_DATA + 4,
      true
    );
    let speedRevolutionCount = data.getUint16(
      Messages.BUFFER_INDEX_MSG_DATA + 6,
      true
    );

    if (speedEventTime !== oldSpeedTime) {
      this.SpeedEventTime = speedEventTime;
      this.CumulativeSpeedRevolutionCount = speedRevolutionCount;

      if (oldSpeedTime && oldSpeedTime > speedEventTime) {
        // Hit rollover value
        speedEventTime += 1024 * 64;
      }

      if (oldSpeedCount && oldSpeedCount > speedRevolutionCount) {
        // Hit rollover value
        speedRevolutionCount += 1024 * 64;
      }

      const distance =
        wheelCircumference * (speedRevolutionCount - (oldSpeedCount || 0));
      this.CalculatedDistance = distance;

      // speed in m/sec
      const speed = (distance * 1024) / (speedEventTime - (oldSpeedTime || 0));
      if (!isNaN(speed)) {
        this.CalculatedSpeed = speed;
        return this;
      }
    }
  }
}
