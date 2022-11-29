/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#525_tab
 * Spec sheet: https://www.thisisant.com/resources/fitness-equipment-device/
 */

import { FitnessEquipmentSensorState } from './FitnessEquipmentSensorState';

export class FitnessEquipmentScanState extends FitnessEquipmentSensorState {
  Rssi?: number;

  Threshold?: number;
}
