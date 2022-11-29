/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { SpeedCadenceSensorState } from './SpeedCadenceSensorState';

export class SpeedCadenceScanState extends SpeedCadenceSensorState {
  Rssi?: number;

  Threshold?: number;
}
