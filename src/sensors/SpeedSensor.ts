/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed/
 */

import { updateSpeedSensorState } from '../lib/UpdateState';
import { AntPlusSensor } from './AntPlusSensor';
import { SpeedSensorState } from './SpeedSensorState';

export class SpeedSensor extends AntPlusSensor {
  static deviceType = 0x7b;

  wheelCircumference = 2.199; // default 70cm wheel

  public setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  public async attachSensor(channel: number, deviceID: number): Promise<void> {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: SpeedSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8086,
    });
    this.state = new SpeedSensorState(deviceID);
  }

  private state?: SpeedSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('SpeedSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateSpeedSensorState(this, this.state, data);
  }
}
