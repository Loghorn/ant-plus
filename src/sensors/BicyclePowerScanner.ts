/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import { updateBicyclePowerSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { BicyclePowerScanState } from './BicyclePowerScanState';
import { BicyclePowerSensor } from './BicyclePowerSensor';

export class BicyclePowerScanner extends AntPlusScanner {
  protected deviceType() {
    return BicyclePowerSensor.deviceType;
  }

  private states: { [id: number]: BicyclePowerScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new BicyclePowerScanState(deviceId);
    }
  }

  protected updateRssiAndThreshold(
    deviceId: number,
    rssi: number,
    threshold: number
  ) {
    this.states[deviceId].Rssi = rssi;
    this.states[deviceId].Threshold = threshold;
  }

  protected updateState(deviceId: number, data: DataView) {
    updateBicyclePowerSensorState(this, this.states[deviceId], data);
  }
}
