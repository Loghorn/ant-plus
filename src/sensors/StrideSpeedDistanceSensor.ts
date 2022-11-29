/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#528_tab
 * Spec sheet: https://www.thisisant.com/resources/stride-based-speed-and-distance-monitor/
 */

import { updateStrideSpeedDistanceSensorState } from '../lib/UpdateState';
import { AntPlusSensor } from './AntPlusSensor';
import { StrideSpeedDistanceSensorState } from './StrideSpeedDistanceSensorState';

export class StrideSpeedDistanceSensor extends AntPlusSensor {
  static deviceType = 124;

  public async attachSensor(channel: number, deviceID: number) {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: StrideSpeedDistanceSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8134,
    });
    this.state = new StrideSpeedDistanceSensorState(deviceID);
  }

  private state?: StrideSpeedDistanceSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('StrideSpeedDistanceSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateStrideSpeedDistanceSensorState(this, this.state, data);
  }
}
