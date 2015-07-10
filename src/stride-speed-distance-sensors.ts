/// <reference path="../typings/tsd.d.ts"/>
/// <reference path="../typings/ant.d.ts"/>

import Ant = require('./ant');

var Constants = Ant.Constants;
var Messages = Ant.Messages;

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
				{
					if (this.deviceID === 0) {
						this.write(Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID));
					}

					var page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
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
								{
									this.state.Calories = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
									break;
								}
						}
					}
					this.emit('ssddata', this.state);
				} break;
			case Constants.MESSAGE_CHANNEL_ID:
				{
					this.deviceID = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
					this.transmissionType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
					this.state.DeviceID = this.deviceID;
				} break;
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

    states: { [id: number]: StrideSpeedDistanceSensorState } = {};

	decodeData(data: Buffer) {
		var msglen = data.readUInt8(Messages.BUFFER_INDEX_MSG_LEN);

		var extMsgBegin = msglen - 2;
		if (data.readUInt8(extMsgBegin) !== 0x80) {
			console.log('wrong message format');
			return;
		}

		var deviceId = data.readUInt16LE(extMsgBegin + 1);
		var deviceType = data.readUInt8(extMsgBegin + 3);

		if (deviceType !== StrideSpeedDistanceScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new StrideSpeedDistanceSensorState(deviceId);
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				{
					var page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
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
								{
									this.states[deviceId].Calories = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
									break;
								}
						}
					}
					this.emit('ssddata', this.states[deviceId]);
				} break;
		}
	}
}
