/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#525_tab
 * Spec sheet: https://www.thisisant.com/resources/fitness-equipment-device/
 */

import { SendCallback } from '../ant';
import { updateFitnessEquipmentSensorState } from '../lib/UpdateState';
import { Messages } from '../Messages';
import { AntPlusSensor } from './AntPlusSensor';
import { FitnessEquipmentSensorState } from './FitnessEquipmentSensorState';

export class FitnessEquipmentSensor extends AntPlusSensor {
  static deviceType = 0x11;

  public async attachSensor(channel: number, deviceID: number): Promise<void> {
    await super.attach({
      channel,
      type: 'receive',
      deviceID,
      deviceType: FitnessEquipmentSensor.deviceType,
      transmissionType: 0,
      timeout: 255,
      period: 8192,
    });
    this.state = new FitnessEquipmentSensorState(deviceID);
  }

  private state?: FitnessEquipmentSensorState;

  protected updateState(deviceId: number, data: DataView) {
    if (!this.state) {
      throw new Error('FitnessEquipmentSensor: not attached');
    }
    this.state.DeviceID = deviceId;
    updateFitnessEquipmentSensorState(this, this.state, data);
  }

  private _setUserConfiguration(
    userWeight?: number,
    bikeWeight?: number,
    wheelDiameter?: number,
    gearRatio?: number,
    cbk?: SendCallback
  ) {
    if (this.channel === undefined) {
      throw new Error('FitnessEquipmentSensor: not attached');
    }
    const m =
      userWeight === undefined
        ? 0xffff
        : Math.max(0, Math.min(65534, Math.round(userWeight * 100)));
    const df =
      wheelDiameter === undefined ? 0xff : Math.round(wheelDiameter * 10) % 10;
    const mb =
      bikeWeight === undefined
        ? 0xfff
        : Math.max(0, Math.min(1000, Math.round(bikeWeight * 20)));
    const d =
      wheelDiameter === undefined
        ? 0xff
        : Math.max(0, Math.min(254, Math.round(wheelDiameter)));
    const gr =
      gearRatio === undefined
        ? 0x00
        : Math.max(1, Math.min(255, Math.round(gearRatio / 0.03)));
    const payload = [
      0x37,
      m & 0xff,
      (m >> 8) & 0xff,
      0xff,
      (df & 0xf) | ((mb & 0xf) << 4),
      (mb >> 4) & 0xf,
      d & 0xff,
      gr & 0xff,
    ];
    const msg = Messages.acknowledgedData(this.channel, payload);
    this.send(msg, cbk);
  }

  public setUserConfiguration(cbk: SendCallback): void;

  public setUserConfiguration(userWeight: number, cbk?: SendCallback): void;

  public setUserConfiguration(
    userWeight: number,
    bikeWeight: number,
    cbk?: SendCallback
  ): void;

  public setUserConfiguration(
    userWeight: number,
    bikeWeight: number,
    wheelDiameter: number,
    cbk?: SendCallback
  ): void;

  public setUserConfiguration(
    userWeight: number,
    bikeWeight: number,
    wheelDiameter: number,
    gearRatio: number,
    cbk?: SendCallback
  ): void;

  public setUserConfiguration(
    userWeight?: number | SendCallback,
    bikeWeight?: number | SendCallback,
    wheelDiameter?: number | SendCallback,
    gearRatio?: number | SendCallback,
    cbk?: SendCallback
  ) {
    if (typeof userWeight === 'function') {
      return this._setUserConfiguration(
        undefined,
        undefined,
        undefined,
        undefined,
        userWeight
      );
    }
    if (typeof bikeWeight === 'function') {
      return this._setUserConfiguration(
        userWeight,
        undefined,
        undefined,
        undefined,
        bikeWeight
      );
    }
    if (typeof wheelDiameter === 'function') {
      return this._setUserConfiguration(
        userWeight,
        bikeWeight,
        undefined,
        undefined,
        wheelDiameter
      );
    }
    if (typeof gearRatio === 'function') {
      return this._setUserConfiguration(
        userWeight,
        bikeWeight,
        wheelDiameter,
        undefined,
        gearRatio
      );
    }
    return this._setUserConfiguration(
      userWeight,
      bikeWeight,
      wheelDiameter,
      gearRatio,
      cbk
    );
  }

  public setBasicResistance(resistance: number, cbk?: SendCallback) {
    if (this.channel === undefined) {
      throw new Error('Channel not attached');
    }
    const res = Math.max(0, Math.min(200, Math.round(resistance * 2)));
    const payload = [0x30, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, res & 0xff];
    const msg = Messages.acknowledgedData(this.channel, payload);
    this.send(msg, cbk);
  }

  public setTargetPower(power: number, cbk?: SendCallback) {
    if (this.channel === undefined) {
      throw new Error('Channel not attached');
    }
    const p = Math.max(0, Math.min(4000, Math.round(power * 4)));
    const payload = [
      0x31,
      0xff,
      0xff,
      0xff,
      0xff,
      0xff,
      p & 0xff,
      (p >> 8) & 0xff,
    ];
    const msg = Messages.acknowledgedData(this.channel, payload);
    this.send(msg, cbk);
  }

  private _setWindResistance(
    windCoeff?: number,
    windSpeed?: number,
    draftFactor?: number,
    cbk?: SendCallback
  ) {
    if (this.channel === undefined) {
      throw new Error('Channel not attached');
    }
    const wc =
      windCoeff === undefined
        ? 0xff
        : Math.max(0, Math.min(186, Math.round(windCoeff * 100)));
    const ws =
      windSpeed === undefined
        ? 0xff
        : Math.max(0, Math.min(254, Math.round(windSpeed + 127)));
    const df =
      draftFactor === undefined
        ? 0xff
        : Math.max(0, Math.min(100, Math.round(draftFactor * 100)));
    const payload = [
      0x32,
      0xff,
      0xff,
      0xff,
      0xff,
      wc & 0xff,
      ws & 0xff,
      df & 0xff,
    ];
    const msg = Messages.acknowledgedData(this.channel, payload);
    this.send(msg, cbk);
  }

  public setWindResistance(cbk: SendCallback): void;

  public setWindResistance(windCoeff: number, cbk?: SendCallback): void;

  public setWindResistance(
    windCoeff: number,
    windSpeed: number,
    cbk?: SendCallback
  ): void;

  public setWindResistance(
    windCoeff: number,
    windSpeed: number,
    draftFactor: number,
    cbk?: SendCallback
  ): void;

  public setWindResistance(
    windCoeff?: number | SendCallback,
    windSpeed?: number | SendCallback,
    draftFactor?: number | SendCallback,
    cbk?: SendCallback
  ) {
    if (typeof windCoeff === 'function') {
      return this._setWindResistance(
        undefined,
        undefined,
        undefined,
        windCoeff
      );
    }
    if (typeof windSpeed === 'function') {
      return this._setWindResistance(
        windCoeff,
        undefined,
        undefined,
        windSpeed
      );
    }
    if (typeof draftFactor === 'function') {
      return this._setWindResistance(
        windCoeff,
        windSpeed,
        undefined,
        draftFactor
      );
    }
    return this._setWindResistance(windCoeff, windSpeed, draftFactor, cbk);
  }

  private _setTrackResistance(
    slope?: number,
    rollingResistanceCoeff?: number,
    cbk?: SendCallback
  ) {
    if (this.channel === undefined) {
      throw new Error('Channel not attached');
    }
    const s =
      slope === undefined
        ? 0xffff
        : Math.max(0, Math.min(40000, Math.round((slope + 200) * 100)));
    const rr =
      rollingResistanceCoeff === undefined
        ? 0xff
        : Math.max(
            0,
            Math.min(254, Math.round(rollingResistanceCoeff * 20000))
          );
    const payload = [
      0x33,
      0xff,
      0xff,
      0xff,
      0xff,
      s & 0xff,
      (s >> 8) & 0xff,
      rr & 0xff,
    ];
    const msg = Messages.acknowledgedData(this.channel, payload);
    this.send(msg, cbk);
  }

  public setTrackResistance(cbk: SendCallback): void;

  public setTrackResistance(slope: number, cbk?: SendCallback): void;

  public setTrackResistance(
    slope: number,
    rollingResistanceCoeff: number,
    cbk?: SendCallback
  ): void;

  public setTrackResistance(
    slope?: number | SendCallback,
    rollingResistanceCoeff?: number | SendCallback,
    cbk?: SendCallback
  ) {
    if (typeof slope === 'function') {
      return this._setTrackResistance(undefined, undefined, slope);
    }
    if (typeof rollingResistanceCoeff === 'function') {
      return this._setTrackResistance(slope, undefined, rollingResistanceCoeff);
    }
    return this._setTrackResistance(slope, rollingResistanceCoeff, cbk);
  }
}
