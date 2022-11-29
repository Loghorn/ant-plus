/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#2343_tab
 * Spec sheet: https://www.thisisant.com/resources/ant-device-profile-muscle-oxygen/
 */

import { MuscleOxygenSensorState } from './MuscleOxygenSensorState';

export class MuscleOxygenScanState extends MuscleOxygenSensorState {
  Rssi?: number;

  Threshold?: number;
}
