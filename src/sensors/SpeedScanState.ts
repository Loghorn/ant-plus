/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed/
 */

import { SpeedSensorState } from './SpeedSensorState';

export class SpeedScanState extends SpeedSensorState {
  Rssi?: number;

  Threshold?: number;
}
