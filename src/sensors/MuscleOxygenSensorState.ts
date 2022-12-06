/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#2343_tab
 * Spec sheet: https://www.thisisant.com/resources/ant-device-profile-muscle-oxygen/
 */

import { Messages } from '../Messages';

export class MuscleOxygenSensorState {
  constructor(deviceID: number) {
    this.DeviceID = deviceID;
  }

  _EventCount?: number;

  DeviceID: number;

  UTCTimeRequired?: boolean;

  SupportANTFS?: boolean;

  MeasurementInterval?: 0.25 | 0.5 | 1 | 2;

  TotalHemoglobinConcentration?: number | 'AmbientLightTooHigh' | 'Invalid';

  PreviousSaturatedHemoglobinPercentage?:
    | number
    | 'AmbientLightTooHigh'
    | 'Invalid';

  CurrentSaturatedHemoglobinPercentage?:
    | number
    | 'AmbientLightTooHigh'
    | 'Invalid';

  HwVersion?: number;

  ManId?: number;

  ModelNum?: number;

  SwVersion?: number;

  SerialNumber?: number;

  OperatingTime?: number;

  BatteryId?: number;

  BatteryVoltage?: number;

  BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';

  ReceivedAt?: number;

  updateState(data: DataView): MuscleOxygenSensorState | undefined {
    const oldEventCount = this._EventCount || 0;

    const page = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA);
    switch (page) {
      case 0x01: {
        let eventCount = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        const notifications = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        const capabilities = data.getUint16(
          Messages.BUFFER_INDEX_MSG_DATA + 3,
          true
        );
        const total =
          data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 4, true) & 0xfff;
        const previous =
          (data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 5, true) >> 4) &
          0x3ff;
        const current =
          (data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 6, true) >> 6) &
          0x3ff;

        if (eventCount !== oldEventCount) {
          this._EventCount = eventCount;
          if (oldEventCount > eventCount) {
            // Hit rollover value
            eventCount += 255;
          }
        }

        this.UTCTimeRequired = (notifications & 0x01) === 0x01;

        this.SupportANTFS = (capabilities & 0x01) === 0x01;

        switch ((capabilities >> 1) & 0x7) {
          case 1:
            this.MeasurementInterval = 0.25;
            break;
          case 2:
            this.MeasurementInterval = 0.5;
            break;
          case 3:
            this.MeasurementInterval = 1;
            break;
          case 4:
            this.MeasurementInterval = 2;
            break;
          default:
            delete this.MeasurementInterval;
        }

        switch (total) {
          case 0xffe:
            this.TotalHemoglobinConcentration = 'AmbientLightTooHigh';
            break;
          case 0xfff:
            this.TotalHemoglobinConcentration = 'Invalid';
            break;
          default:
            this.TotalHemoglobinConcentration = total;
        }

        switch (previous) {
          case 0x3fe:
            this.PreviousSaturatedHemoglobinPercentage = 'AmbientLightTooHigh';
            break;
          case 0x3ff:
            this.PreviousSaturatedHemoglobinPercentage = 'Invalid';
            break;
          default:
            this.PreviousSaturatedHemoglobinPercentage = previous;
        }

        switch (current) {
          case 0x3fe:
            this.CurrentSaturatedHemoglobinPercentage = 'AmbientLightTooHigh';
            break;
          case 0x3ff:
            this.CurrentSaturatedHemoglobinPercentage = 'Invalid';
            break;
          default:
            this.CurrentSaturatedHemoglobinPercentage = current;
        }

        break;
      }
      case 0x50: {
        this.HwVersion = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        this.ManId = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 4, true);
        this.ModelNum = data.getUint16(
          Messages.BUFFER_INDEX_MSG_DATA + 6,
          true
        );
        break;
      }
      case 0x51: {
        const swRevSup = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        const swRevMain = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const serial = data.getInt32(Messages.BUFFER_INDEX_MSG_DATA + 4, true);

        this.SwVersion = swRevMain;

        if (swRevSup !== 0xff) {
          this.SwVersion += swRevSup / 1000;
        }

        if (serial !== 0xffffffff) {
          this.SerialNumber = serial;
        }

        break;
      }
      case 0x52: {
        this.BatteryId = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        const operatingTime =
          data.getUint32(Messages.BUFFER_INDEX_MSG_DATA + 3, true) & 0xffffff;
        const batteryFrac = data.getInt32(
          Messages.BUFFER_INDEX_MSG_DATA + 6,
          true
        );
        const batteryStatus = data.getInt32(
          Messages.BUFFER_INDEX_MSG_DATA + 7,
          true
        );

        this.OperatingTime =
          operatingTime * ((batteryStatus & 0x80) === 0x80 ? 2 : 16);
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
      default:
        return;
    }

    this.ReceivedAt = Date.now();
    if (page !== 0x01 || this._EventCount !== oldEventCount) {
      return this;
    }
  }
}
