/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { CadenceSensorState } from './CadenceSensorState';

export class CadenceScanState extends CadenceSensorState {
  Rssi?: number;

  Threshold?: number;
}
