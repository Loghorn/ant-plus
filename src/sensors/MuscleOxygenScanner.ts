/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#2343_tab
 * Spec sheet: https://www.thisisant.com/resources/ant-device-profile-muscle-oxygen/
 */

import { updateMuscleOxygenSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { MuscleOxygenScanState } from './MuscleOxygenScanState';
import { MuscleOxygenSensor } from './MuscleOxygenSensor';

export class MuscleOxygenScanner extends AntPlusScanner {
  protected deviceType() {
    return MuscleOxygenSensor.deviceType;
  }

  private states: { [id: number]: MuscleOxygenScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new MuscleOxygenScanState(deviceId);
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
    updateMuscleOxygenSensorState(this, this.states[deviceId], data);
  }
}
