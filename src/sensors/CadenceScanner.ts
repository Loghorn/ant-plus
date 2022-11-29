/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { updateCadenceSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { CadenceScanState } from './CadenceScanState';
import { CadenceSensor } from './CadenceSensor';

export class CadenceScanner extends AntPlusScanner {
  protected deviceType() {
    return CadenceSensor.deviceType;
  }

  wheelCircumference = 2.199; // default 70cm wheel

  public setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  private states: { [id: number]: CadenceScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new CadenceScanState(deviceId);
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
    updateCadenceSensorState(this, this.states[deviceId], data);
  }
}
