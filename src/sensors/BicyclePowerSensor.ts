/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import { updateBicyclePowerSensorState } from '../lib/UpdateState';
import { AntPlusSensor } from './AntPlusSensor';
import { BicyclePowerSensorState } from './BicyclePowerSensorState';

export class BicyclePowerSensor extends AntPlusSensor {
  static deviceType = 0x0b;

  public async attachSensor(channel: number, deviceID: number): Promise<void> {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: BicyclePowerSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8182,
    });
    this.state = new BicyclePowerSensorState(deviceID);
  }

  private state?: BicyclePowerSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('BicyclePowerSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateBicyclePowerSensorState(this, this.state, data);
  }
}
