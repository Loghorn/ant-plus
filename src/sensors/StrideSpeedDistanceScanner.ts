/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#528_tab
 * Spec sheet: https://www.thisisant.com/resources/stride-based-speed-and-distance-monitor/
 */

import { updateStrideSpeedDistanceSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { StrideSpeedDistanceScanState } from './StrideSpeedDistanceScanState';
import { StrideSpeedDistanceSensor } from './StrideSpeedDistanceSensor';

export class StrideSpeedDistanceScanner extends AntPlusScanner {
  protected deviceType() {
    return StrideSpeedDistanceSensor.deviceType;
  }

  private states: { [id: number]: StrideSpeedDistanceScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new StrideSpeedDistanceScanState(deviceId);
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
    updateStrideSpeedDistanceSensorState(this, this.states[deviceId], data);
  }
}
