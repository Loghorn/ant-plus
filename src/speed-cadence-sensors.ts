/// <reference path="../typings/tsd.d.ts"/>
import Ant = require('./ant');

let Messages = Ant.Messages;
let Constants = Ant.Constants;

class SpeedCadenceSensorState {
  DeviceID: number;
  CadenceEventTime: number;
  CumulativeCadenceRevolutionCount: number;
  SpeedEventTime: number;
  CumulativeSpeedRevolutionCount: number;
  CalculatedCadence: number;
  CalculatedSpeed: number;

  constructor(deviceID: number) {
    this.DeviceID = deviceID;
  }
}

/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */
export class SpeedCadenceSensor extends Ant.AntPlusSensor {
  channel: number;
  static deviceType = 0x79;
  state: SpeedCadenceSensorState;
  wheelCircumference: number = 2.118; //This is my 700c wheel, just using as default

  setWheelCircumference(wheelCircumference: number) {
    this.wheelCircumference = wheelCircumference;
  }

  constructor(stick) {
    super(stick);
    this.decodeDataCbk = this.decodeData.bind(this);
  }

  public attach(channel, deviceID): void {
    super.attach(channel, 'receive', deviceID, SpeedCadenceSensor.deviceType, 0, 255, 8086);
    this.state = new SpeedCadenceSensorState(deviceID);
  }

  decodeData(data: Buffer) {
    let channel = data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM);
    let type = data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE);

    if (channel !== this.channel) {
      return;
    }

    switch (type) {
      case Constants.MESSAGE_CHANNEL_BROADCAST_DATA: {
        if (this.state.DeviceID === 0) {
          return;  //for now, let's not use the data
        }

        //get old state for calculating cumulative values
        let oldCadenceTime = this.state.CadenceEventTime;
        let oldCadenceCount = this.state.CumulativeCadenceRevolutionCount;
        let oldSpeedTime = this.state.SpeedEventTime;
        let oldSpeedCount = this.state.CumulativeSpeedRevolutionCount;

        let cadenceTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
        cadenceTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1) << 8;

        let cadenceCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        cadenceCount |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 8;

        let speedEventTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
        speedEventTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5) << 8;

        let speedRevolutionCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
        speedRevolutionCount |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7) << 8;

        if (cadenceTime !== oldCadenceTime) {
          this.state.CadenceEventTime = cadenceTime;
          this.state.CumulativeCadenceRevolutionCount = cadenceCount;

          if (oldCadenceTime > cadenceTime) { //Hit rollover value
            cadenceTime += (1024 * 64);
          }
          let cadence = ( (60 * (cadenceCount - oldCadenceCount) * 1024) / (cadenceTime - oldCadenceTime) );
          this.state.CalculatedCadence = cadence;
          if (!isNaN(this.state.CalculatedCadence)) {
            this.emit('cadenceData', this.state);
          }
        }

        if (speedEventTime !== oldSpeedTime) {
          this.state.SpeedEventTime = speedEventTime;
          this.state.CumulativeSpeedRevolutionCount = speedRevolutionCount;
          //speed in km/sec
          if (oldSpeedTime > speedEventTime) { //Hit rollover value
            speedEventTime += (1024 * 64);
          }
          let speed = ( this.wheelCircumference * (speedRevolutionCount - oldSpeedCount) * 1024) / (speedEventTime - oldSpeedTime);
          let speedMph = speed * 2.237; //according to wolfram alpha

          this.state.CalculatedSpeed = speedMph;
          if (!isNaN(this.state.CalculatedSpeed)) {
            this.emit('speedData', this.state);
          }
        }
        break;
      }
      case Constants.CHANNEL_TYPE_ONEWAY_RECEIVE: {
        this.deviceID = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
        this.transmissionType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        this.state.DeviceID = this.deviceID;
      }
    }
  }

};
