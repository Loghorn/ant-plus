/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { updateCadenceSensorState } from '../lib/UpdateState';
import { AntPlusSensor } from './AntPlusSensor';
import { CadenceSensorState } from './CadenceSensorState';

export class CadenceSensor extends AntPlusSensor {
  static deviceType = 0x7a;

  wheelCircumference = 2.199; // default 70cm wheel

  public setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  public async attachSensor(channel: number, deviceID: number): Promise<void> {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: CadenceSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8086,
    });
    this.state = new CadenceSensorState(deviceID);
  }

  private state?: CadenceSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('CadenceSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateCadenceSensorState(this, this.state, data);
  }
}
