/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#526_tab
 * Spec sheet: https://www.thisisant.com/resources/heart-rate-monitor/
 */

import { Page, PageState } from '../ant';
import { Messages } from '../Messages';

export class HeartRateSensorState {
  constructor(deviceId: number) {
    this.DeviceID = deviceId;
  }

  DeviceID: number;

  BeatTime?: number;

  BeatCount?: number;

  ComputedHeartRate?: number;

  OperatingTime?: number;

  ManId?: number;

  SerialNumber?: number;

  HwVersion?: number;

  SwVersion?: number;

  ModelNum?: number;

  PreviousBeat?: number;

  IntervalAverage?: number;

  IntervalMax?: number;

  SessionAverage?: number;

  SupportedFeatures?: number;

  EnabledFeatures?: number;

  BatteryLevel?: number;

  BatteryVoltage?: number;

  BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';

  updateState(data: DataView, page: Page): HeartRateSensorState {
    const TOGGLE_MASK = 0x80;
    const pageNum = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA);
    if (page.pageState === PageState.INIT_PAGE) {
      page.pageState = PageState.STD_PAGE; // change the state to STD_PAGE and allow the checking of old and new pages
      // decode with pages if the page byte or toggle bit has changed
    } else if (
      pageNum !== page.oldPage ||
      page.pageState === PageState.EXT_PAGE
    ) {
      page.pageState = PageState.EXT_PAGE; // set the state to use the extended page format
      switch (
        pageNum & ~TOGGLE_MASK // check the new pages and remove the toggle bit
      ) {
        case 1:
          // decode the cumulative operating time
          this.OperatingTime = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 1
          );
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
        case 4:
          // decode the previous heart beat measurement time
          this.PreviousBeat = data.getUint16(
            Messages.BUFFER_INDEX_MSG_DATA + 2,
            true
          );
          break;
        case 5:
          this.IntervalAverage = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 1
          );
          this.IntervalMax = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
          this.SessionAverage = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 3
          );
          break;
        case 6:
          this.SupportedFeatures = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 2
          );
          this.EnabledFeatures = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 3
          );
          break;
        case 7: {
          const batteryLevel = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 1
          );
          const batteryFrac = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
          const batteryStatus = data.getUint8(
            Messages.BUFFER_INDEX_MSG_DATA + 3
          );
          if (batteryLevel !== 0xff) {
            this.BatteryLevel = batteryLevel;
          }
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
          break;
      }
    }
    // decode the last four bytes of the HRM format, the first byte of this message is the channel number
    this.decodeDefaultHRM(
      new DataView(data.buffer.slice(Messages.BUFFER_INDEX_MSG_DATA + 4))
    );
    page.oldPage = pageNum;

    return this;
  }

  private decodeDefaultHRM(pucPayload: DataView) {
    // decode the measurement time data (two bytes)
    this.BeatTime = pucPayload.getUint16(0, true);
    // decode the measurement count data
    this.BeatCount = pucPayload.getUint8(2);
    // decode the measurement count data
    this.ComputedHeartRate = pucPayload.getUint8(3);
  }
}
