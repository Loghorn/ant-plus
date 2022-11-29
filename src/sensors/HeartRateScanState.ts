/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#526_tab
 * Spec sheet: https://www.thisisant.com/resources/heart-rate-monitor/
 */

import { HeartRateSensorState } from './HeartRateSensorState';

export class HeartRateScanState extends HeartRateSensorState {
  Rssi?: number;

  Threshold?: number;
}
