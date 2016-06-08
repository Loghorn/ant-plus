/// <reference path="../typings/index.d.ts"/>

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class SpeedCadenceSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	CadenceEventTime: number;
	CumulativeCadenceRevolutionCount: number;
	SpeedEventTime: number;
	CumulativeSpeedRevolutionCount: number;
	CalculatedCadence: number;
	CalculatedSpeed: number;
}

class SpeedCadenceScanState extends SpeedCadenceSensorState {
	Rssi: number;
	Threshold: number;
}

const updateState = function (sensor: SpeedCadenceSensor | SpeedCadenceScanner,
	state: SpeedCadenceSensorState | SpeedCadenceScanState, data: Buffer) {
	//get old state for calculating cumulative values
	let oldCadenceTime = state.CadenceEventTime;
	let oldCadenceCount = state.CumulativeCadenceRevolutionCount;
	let oldSpeedTime = state.SpeedEventTime;
	let oldSpeedCount = state.CumulativeSpeedRevolutionCount;

	let cadenceTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	cadenceTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1) << 8;

	let cadenceCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
	cadenceCount |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 8;

	let speedEventTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
	speedEventTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5) << 8;

	let speedRevolutionCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
	speedRevolutionCount |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7) << 8;

	if (cadenceTime !== oldCadenceTime) {
		state.CadenceEventTime = cadenceTime;
		state.CumulativeCadenceRevolutionCount = cadenceCount;

		if (oldCadenceTime > cadenceTime) { //Hit rollover value
			cadenceTime += (1024 * 64);
		}
		let cadence = ((60 * (cadenceCount - oldCadenceCount) * 1024) / (cadenceTime - oldCadenceTime));
		state.CalculatedCadence = cadence;
		if (!isNaN(state.CalculatedCadence)) {
			sensor.emit('cadenceData', state);
		}
	}

	if (speedEventTime !== oldSpeedTime) {
		state.SpeedEventTime = speedEventTime;
		state.CumulativeSpeedRevolutionCount = speedRevolutionCount;
		//speed in km/sec
		if (oldSpeedTime > speedEventTime) { //Hit rollover value
			speedEventTime += (1024 * 64);
		}
		let speed = (sensor.wheelCircumference * (speedRevolutionCount - oldSpeedCount) * 1024) / (speedEventTime - oldSpeedTime);
		let speedMph = speed * 2.237; //according to wolfram alpha

		state.CalculatedSpeed = speedMph;
		if (!isNaN(state.CalculatedSpeed)) {
			sensor.emit('speedData', state);
		}
	}
};

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
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
				if (this.deviceID === 0) {
					this.write(Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID));
				}

				updateState(this, this.state, data);
				break;

			case Constants.MESSAGE_CHANNEL_ID:
				this.deviceID = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
				this.transmissionType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				this.state.DeviceID = this.deviceID;
				break;
			default:
				break;
		}
	}

}

export class SpeedCadenceScanner extends Ant.AntPlusScanner {
	static deviceType = 0x79;
	wheelCircumference: number = 2.118; //This is my 700c wheel, just using as default

	states: { [id: number]: SpeedCadenceScanState } = {};

	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}

	public scan() {
		super.scan('receive');
	}

	decodeData(data: Buffer) {
		if (!(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		let deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		let deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== SpeedCadenceScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new SpeedCadenceScanState(deviceId);
		}

		if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
			if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
				this.states[deviceId].Rssi = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6);
				this.states[deviceId].Threshold = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7);
			}
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
				updateState(this, this.states[deviceId], data);
				break;
			default:
				break;
		}
	}
}
