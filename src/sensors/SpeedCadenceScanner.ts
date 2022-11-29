/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { updateSpeedCadenceSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { SpeedCadenceScanState } from './SpeedCadenceScanState';
import { SpeedCadenceSensor } from './SpeedCadenceSensor';

export class SpeedCadenceScanner extends AntPlusScanner {
  protected deviceType() {
    return SpeedCadenceSensor.deviceType;
  }

  wheelCircumference = 2.199; // default 70cm wheel

  public setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  private states: { [id: number]: SpeedCadenceScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new SpeedCadenceScanState(deviceId);
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
    updateSpeedCadenceSensorState(this, this.states[deviceId], data);
  }
}
