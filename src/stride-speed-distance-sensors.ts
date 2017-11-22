/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#528_tab
 * Spec sheet: https://www.thisisant.com/resources/stride-based-speed-and-distance-monitor/
 */

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

	private state: StrideSpeedDistanceSensorState;

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

export class StrideSpeedDistanceScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 124;

	public scan() {
		super.scan('receive');
	}

	private states: { [id: number]: StrideSpeedDistanceScanState } = {};

	decodeData(data: Buffer) {
		if (data.length <= (Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3) || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

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
				updateState(this, this.states[deviceId], data);
				break;
			default:
				break;
		}
	}
}

function updateState(
	sensor: StrideSpeedDistanceSensor | StrideSpeedDistanceScanner,
	state: StrideSpeedDistanceSensorState | StrideSpeedDistanceScanState,
	data: Buffer) {

	const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	if (page === 1) {
		state.TimeFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
		state.TimeInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
		state.DistanceInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
		state.DistanceFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) >>> 4;
		state.SpeedInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0x0F;
		state.SpeedFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
		state.StrideCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
		state.UpdateLatency = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
	} else if (page >= 2 && page <= 15) {
		state.CadenceInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
		state.CadenceFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) >>> 4;
		state.SpeedInteger = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0x0F;
		state.SpeedFractional = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
		state.Status = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

		switch (page) {
			case 3:
				state.Calories = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
				break;
			default:
				break;
		}
	}
	sensor.emit('ssddata', state);
	sensor.emit('ssdData', state);
}
