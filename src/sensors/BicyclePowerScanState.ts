/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import { BicyclePowerSensorState } from './BicyclePowerSensorState';

export class BicyclePowerScanState extends BicyclePowerSensorState {
  Rssi: number;

  Threshold: number;

  constructor(deviceId: number) {
    super(deviceId);
    this.Rssi = 0;
    this.Threshold = 0;
  }
}
