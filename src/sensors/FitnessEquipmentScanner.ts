/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#525_tab
 * Spec sheet: https://www.thisisant.com/resources/fitness-equipment-device/
 */

import { updateFitnessEquipmentSensorState } from '../lib/UpdateState';
import { AntPlusScanner } from './AntPlusScanner';
import { FitnessEquipmentScanState } from './FitnessEquipmentScanState';
import { FitnessEquipmentSensor } from './FitnessEquipmentSensor';

export class FitnessEquipmentScanner extends AntPlusScanner {
  protected deviceType() {
    return FitnessEquipmentSensor.deviceType;
  }

  private states: { [id: number]: FitnessEquipmentScanState } = {};

  protected createStateIfNew(deviceId: number) {
    if (!this.states[deviceId]) {
      this.states[deviceId] = new FitnessEquipmentScanState(deviceId);
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
    updateFitnessEquipmentSensorState(this, this.states[deviceId], data);
  }
}
