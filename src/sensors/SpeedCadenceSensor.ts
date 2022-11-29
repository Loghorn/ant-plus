/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { updateSpeedCadenceSensorState } from '../lib/UpdateState';
import { AntPlusSensor } from './AntPlusSensor';
import { SpeedCadenceSensorState } from './SpeedCadenceSensorState';

export class SpeedCadenceSensor extends AntPlusSensor {
  static deviceType = 0x79;

  wheelCircumference = 2.199; // default 70cm wheel

  public setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  public async attachSensor(channel: number, deviceID: number): Promise<void> {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: SpeedCadenceSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8086,
    });
    this.state = new SpeedCadenceSensorState(deviceID);
  }

  private state?: SpeedCadenceSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('SpeedCadenceSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateSpeedCadenceSensorState(this, this.state, data);
  }
}
