/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { Messages } from '../Messages';

export class CadenceSensorState {
  constructor(deviceID: number) {
    this.DeviceID = deviceID;
  }

  DeviceID: number;

  CadenceEventTime?: number;

  CumulativeCadenceRevolutionCount?: number;

  CalculatedCadence?: number;

  OperatingTime?: number;

  ManId?: number;

  SerialNumber?: number;

  HwVersion?: number;

  SwVersion?: number;

  ModelNum?: number;

  BatteryVoltage?: number;

  BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';

  Motion?: boolean;

  updateState(data: DataView): CadenceSensorState {
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
    const oldCadenceTime = this.CadenceEventTime;
    const oldCadenceCount = this.CumulativeCadenceRevolutionCount;

    let cadenceTime = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 4, true);
    let cadenceCount = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 6, true);

    if (cadenceTime !== oldCadenceTime) {
      this.CadenceEventTime = cadenceTime;
      this.CumulativeCadenceRevolutionCount = cadenceCount;

      if (oldCadenceTime && oldCadenceTime > cadenceTime) {
        // Hit rollover value
        cadenceTime += 1024 * 64;
      }

      if (oldCadenceCount && oldCadenceCount > cadenceCount) {
        // Hit rollover value
        cadenceCount += 1024 * 64;
      }

      const cadence =
        (60 * (cadenceCount - (oldCadenceCount || 0)) * 1024) /
        (cadenceTime - (oldCadenceTime || 0));
      if (!isNaN(cadence)) {
        this.CalculatedCadence = cadence;
      }
    }

    return this;
  }
}
