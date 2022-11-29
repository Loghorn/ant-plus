/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#526_tab
 * Spec sheet: https://www.thisisant.com/resources/heart-rate-monitor/
 */

import { Page, PageState } from '../ant';
import { updateHeartRateSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { HeartRateScanState } from './HeartRateScanState';
import { HeartRateSensor } from './HeartRateSensor';

export class HeartRateScanner extends AntPlusScanner {
  protected deviceType() {
    return HeartRateSensor.deviceType;
  }

  private states: { [id: number]: HeartRateScanState } = {};

  private pages: { [id: number]: Page } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new HeartRateScanState(deviceId);
    }

    if (!this.pages[deviceId]) {
      this.pages[deviceId] = { oldPage: -1, pageState: PageState.INIT_PAGE };
    }
  }

  protected updateRssiAndThreshold(
    deviceId: number,
    rssi: number | undefined,
    threshold: number | undefined
  ) {
    this.states[deviceId].Rssi = rssi;
    this.states[deviceId].Threshold = threshold;
  }

  protected updateState(deviceId: number, data: DataView) {
    updateHeartRateSensorState(
      this,
      this.states[deviceId],
      data,
      this.pages[deviceId]
    );
  }
}
