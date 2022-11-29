/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#2343_tab
 * Spec sheet: https://www.thisisant.com/resources/ant-device-profile-muscle-oxygen/
 */

import { SendCallback } from '../ant';
import { updateMuscleOxygenSensorState } from '../lib/UpdateState';
import { Messages } from '../Messages';
import { AntPlusSensor } from './AntPlusSensor';
import { MuscleOxygenSensorState } from './MuscleOxygenSensorState';

export class MuscleOxygenSensor extends AntPlusSensor {
  static deviceType = 0x1f;

  public async attachSensor(channel: number, deviceID: number): Promise<void> {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: MuscleOxygenSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8192,
    });
    this.state = new MuscleOxygenSensorState(deviceID);
  }

  private state?: MuscleOxygenSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('MuscleOxygenSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateMuscleOxygenSensorState(this, this.state, data);
  }

  private _sendTimeCmd(cmd: number, cbk?: SendCallback) {
    if (this.channel === undefined) {
      throw new Error('MuscleOxygenSensor: not attached');
    }
    const now = new Date();
    const utc = Math.round(
      (now.getTime() - Date.UTC(1989, 11, 31, 0, 0, 0, 0)) / 1000
    );
    const offset = -Math.round(now.getTimezoneOffset() / 15);
    const payload = [
      0x10,
      cmd & 0xff,
      0xff,
      offset & 0xff,
      (utc >> 0) & 0xff,
      (utc >> 8) & 0xff,
      (utc >> 16) & 0xff,
      (utc >> 24) & 0xff,
    ];
    const msg = Messages.acknowledgedData(this.channel, payload);
    this.send(msg, cbk);
  }

  public setUTCTime(cbk?: SendCallback) {
    this._sendTimeCmd(0x00, cbk);
  }

  public startSession(cbk?: SendCallback) {
    this._sendTimeCmd(0x01, cbk);
  }

  public stopSession(cbk?: SendCallback) {
    this._sendTimeCmd(0x02, cbk);
  }

  public setLap(cbk?: SendCallback) {
    this._sendTimeCmd(0x03, cbk);
  }
}
