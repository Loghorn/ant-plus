/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#528_tab
 * Spec sheet: https://www.thisisant.com/resources/stride-based-speed-and-distance-monitor/
 */

import { StrideSpeedDistanceSensorState } from './StrideSpeedDistanceSensorState';

export class StrideSpeedDistanceScanState extends StrideSpeedDistanceSensorState {
  Rssi?: number;

  Threshold?: number;
}
