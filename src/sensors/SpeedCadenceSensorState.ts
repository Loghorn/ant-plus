/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { Messages } from '../Messages';

export class SpeedCadenceSensorState {
  constructor(deviceID: number) {
    this.DeviceID = deviceID;
  }

  DeviceID: number;

  CadenceEventTime?: number;

  CumulativeCadenceRevolutionCount?: number;

  SpeedEventTime?: number;

  CumulativeSpeedRevolutionCount?: number;

  CalculatedCadence?: number;

  CalculatedDistance?: number;

  CalculatedSpeed?: number;

  ReceivedAt?: number;

  updateState(
    data: DataView,
    wheelCircumference: number
  ): {
    updatedState: SpeedCadenceSensorState;
    resultType: 'cadence' | 'speed' | 'both' | 'none';
  } {
    // get old state for calculating cumulative values
    const oldCadenceTime = this.CadenceEventTime;
    const oldCadenceCount = this.CumulativeCadenceRevolutionCount;
    const oldSpeedTime = this.SpeedEventTime;
    const oldSpeedCount = this.CumulativeSpeedRevolutionCount;

    let cadenceTime = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA, false);
    let cadenceCount = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 2, true);
    let speedEventTime = data.getUint16(
      Messages.BUFFER_INDEX_MSG_DATA + 4,
      true
    );
    let speedRevolutionCount = data.getUint16(
      Messages.BUFFER_INDEX_MSG_DATA + 6,
      true
    );

    let cadenceDataChanged = false;
    let speedDataChanged = false;

    if (cadenceTime !== oldCadenceTime) {
      this.CadenceEventTime = cadenceTime;
      this.CumulativeCadenceRevolutionCount = cadenceCount;

      if (oldCadenceTime && oldCadenceTime > cadenceTime) {
        // Hit rollover value
        cadenceTime += 1024 * 64;
      }

      if (oldCadenceCount && oldCadenceCount > cadenceCount) {
        // Hit rollover value
        cadenceCount += 1024 * 64;
      }

      const cadence =
        (60 * (cadenceCount - (oldCadenceCount || 0)) * 1024) /
        (cadenceTime - (oldCadenceTime || 0));
      if (!isNaN(cadence)) {
        this.CalculatedCadence = cadence;
        cadenceDataChanged = true;
      }
    }

    if (speedEventTime !== oldSpeedTime) {
      this.SpeedEventTime = speedEventTime;
      this.CumulativeSpeedRevolutionCount = speedRevolutionCount;

      if (oldSpeedTime && oldSpeedTime > speedEventTime) {
        // Hit rollover value
        speedEventTime += 1024 * 64;
      }

      if (oldSpeedCount && oldSpeedCount > speedRevolutionCount) {
        // Hit rollover value
        speedRevolutionCount += 1024 * 64;
      }

      const distance =
        wheelCircumference * (speedRevolutionCount - (oldSpeedCount || 0));
      this.CalculatedDistance = distance;

      // speed in m/sec
      const speed = (distance * 1024) / (speedEventTime - (oldSpeedTime || 0));
      if (!isNaN(speed)) {
        this.CalculatedSpeed = speed;
        speedDataChanged = true;
      }
    }

    this.ReceivedAt = Date.now();

    return {
      updatedState: this,
      resultType:
        cadenceDataChanged && speedDataChanged
          ? 'both'
          : cadenceDataChanged
          ? 'cadence'
          : speedDataChanged
          ? 'speed'
          : 'none',
    };
  }
}
