/// <reference path="../typings/index.d.ts"/>

import Ant = require('./ant');

const Constants = Ant.Constants;
const Messages = Ant.Messages;

class StrideSpeedDistanceSensorState {
	constructor(deviceId: number) {
		this.DeviceID = deviceId;
	}

	DeviceID: number;
	TimeFractional: number;
	TimeInteger: number;
	DistanceInteger: number;
	DistanceFractional: number;
	SpeedInteger: number;
	SpeedFractional: number;
	StrideCount: number;
	UpdateLatency: number;
	CadenceInteger: number;
	CadenceFractional: number;
	Status: number;
	Calories: number;
}

class StrideSpeedDistanceScanState extends StrideSpeedDistanceSensorState {
	Rssi: number;
	Threshold: number;
}

enum PageState { INIT_PAGE, STD_PAGE, EXT_PAGE }

export class StrideSpeedDistanceSensor extends Ant.AntPlusSensor {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 124;

	public attach(channel, deviceID) {
		super.attach(channel, 'receive', deviceID, StrideSpeedDistanceSensor.deviceType, 0, 255, 8134);
		this.state = new StrideSpeedDistanceSensorState(deviceID);
	}

	state: StrideSpeedDistanceSensorState;

	decodeData(data: Buffer) {
		if (data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM) !== this.channel) {
			return;
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				if (this.deviceID === 0) {
					this.write(Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID));
				}

				const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
				if (page === 1) {
					this.state.TimeFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
					this.state.TimeInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
					this.state.DistanceInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
					this.state.DistanceFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) >>> 4;
					this.state.SpeedInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0x0F;
					this.state.SpeedFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
					this.state.StrideCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
					this.state.UpdateLatency = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
				} else if (page >= 2 && page <= 15) {
					this.state.CadenceInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
					this.state.CadenceFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) >>> 4;
					this.state.SpeedInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0x0F;
					this.state.SpeedFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
					this.state.Status = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

					switch (page) {
						case 3:
							this.state.Calories = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
							break;
						default:
							break;
					}
				}
				this.emit('ssddata', this.state);
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

export class StrideSpeedDistanceScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 124;

	public scan() {
		super.scan('receive');
	}

	states: { [id: number]: StrideSpeedDistanceScanState } = {};

	decodeData(data: Buffer) {
		if (data.length <= Messages.BUFFER_INDEX_EXT_MSG_BEGIN || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		let deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		let deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== StrideSpeedDistanceScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new StrideSpeedDistanceScanState(deviceId);
		}

		if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
			if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
				this.states[deviceId].Rssi = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6);
				this.states[deviceId].Threshold = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7);
			}
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				let page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
				if (page === 1) {
					this.states[deviceId].TimeFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
					this.states[deviceId].TimeInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
					this.states[deviceId].DistanceInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
					this.states[deviceId].DistanceFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) >>> 4;
					this.states[deviceId].SpeedInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0x0F;
					this.states[deviceId].SpeedFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
					this.states[deviceId].StrideCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
					this.states[deviceId].UpdateLatency = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
				} else if (page >= 2 && page <= 15) {
					this.states[deviceId].CadenceInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
					this.states[deviceId].CadenceFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) >>> 4;
					this.states[deviceId].SpeedInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0x0F;
					this.states[deviceId].SpeedFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
					this.states[deviceId].Status = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

					switch (page) {
						case 3:
							this.states[deviceId].Calories = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
							break;
						default:
							break;
					}
				}
				this.emit('ssddata', this.states[deviceId]);
				break;
			default:
				break;
		}
	}
}
