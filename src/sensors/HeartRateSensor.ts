/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#526_tab
 * Spec sheet: https://www.thisisant.com/resources/heart-rate-monitor/
 */

import { Page, PageState } from '../ant';
import { updateHeartRateSensorState } from '../lib/UpdateState';
import { AntPlusSensor } from './AntPlusSensor';
import { HeartRateSensorState } from './HeartRateSensorState';

export class HeartRateSensor extends AntPlusSensor {
  static deviceType = 120;

  public async attachSensor(channel: number, deviceID: number) {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: HeartRateSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8070,
    });
    this.state = new HeartRateSensorState(deviceID);
  }

  private state?: HeartRateSensorState;

  private page: Page = {
    oldPage: -1,
    pageState: PageState.INIT_PAGE,
  };

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('HeartRateSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateHeartRateSensorState(this, this.state, data, this.page);
  }
}
