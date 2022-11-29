/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed/
 */

import { updateSpeedSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { SpeedScanState } from './SpeedScanState';
import { SpeedSensor } from './SpeedSensor';

export class SpeedScanner extends AntPlusScanner {
  protected deviceType() {
    return SpeedSensor.deviceType;
  }

  wheelCircumference = 2.199; // default 70cm wheel

  public setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  private states: { [id: number]: SpeedScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new SpeedScanState(deviceId);
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
    updateSpeedSensorState(this, this.states[deviceId], data);
  }
}
