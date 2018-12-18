/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class CadenceSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	CadenceEventTime: number;
	CumulativeCadenceRevolutionCount: number;
	CalculatedCadence: number;

	OperatingTime?: number;
	ManId?: number;
	SerialNumber?: number;
	HwVersion?: number;
	SwVersion?: number;
	ModelNum?: number;
	BatteryVoltage?: number;
	BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';
	Motion?: boolean;
}

class CadenceScanState extends CadenceSensorState {
	Rssi: number;
	Threshold: number;
}

export class CadenceSensor extends Ant.AntPlusSensor {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x7A;

	wheelCircumference: number = 2.118; //This is my 700c wheel, just using as default

	setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, CadenceSensor.deviceType, 0, 255, 8086);
		this.state = new CadenceSensorState(deviceID);
	}

	private state: CadenceSensorState;

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

export class CadenceScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x7A;

	wheelCircumference: number = 2.118; //This is my 700c wheel, just using as default

	setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}

	public scan() {
		super.scan('receive');
	}

	private states: { [id: number]: CadenceScanState } = {};

	decodeData(data: Buffer) {
		if (data.length <= (Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3) || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== CadenceScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new CadenceScanState(deviceId);
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

const TOGGLE_MASK = 0x80;

function updateState(sensor: CadenceSensor | CadenceScanner, state: CadenceSensorState | CadenceScanState, data: Buffer) {
	const pageNum = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	switch (pageNum & ~TOGGLE_MASK) { //check the new pages and remove the toggle bit
		case 1:
			//decode the cumulative operating time
			state.OperatingTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			state.OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2) << 8;
			state.OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 16;
			state.OperatingTime *= 2;
			break;
		case 2:
			//decode the Manufacturer ID
			state.ManId = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			//decode the 4 byte serial number
			state.SerialNumber = sensor.deviceID;
			state.SerialNumber |= data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2) << 16;
			state.SerialNumber >>>= 0;
			break;
		case 3:
			//decode HW version, SW version, and model number
			state.HwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			state.SwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			state.ModelNum = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			break;
		case 4: {
			const batteryFrac = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const batteryStatus = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			state.BatteryVoltage = (batteryStatus & 0x0F) + (batteryFrac / 256);
			const batteryFlags = (batteryStatus & 0x70) >>> 4;
			switch (batteryFlags) {
				case 1:
					state.BatteryStatus = 'New';
					break;
				case 2:
					state.BatteryStatus = 'Good';
					break;
				case 3:
					state.BatteryStatus = 'Ok';
					break;
				case 4:
					state.BatteryStatus = 'Low';
					break;
				case 5:
					state.BatteryStatus = 'Critical';
					break;
				default:
					state.BatteryVoltage = undefined;
					state.BatteryStatus = 'Invalid';
					break;
			}
			break;
		}
		case 5:
			state.Motion = (data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1) & 0x01) === 0x01;
			break;
		default:
			break;
	}

	//get old state for calculating cumulative values
	const oldCadenceTime = state.CadenceEventTime;
	const oldCadenceCount = state.CumulativeCadenceRevolutionCount;

	let cadenceTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
	const cadenceCount = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);

	if (cadenceTime !== oldCadenceTime) {
		state.CadenceEventTime = cadenceTime;
		state.CumulativeCadenceRevolutionCount = cadenceCount;
		if (oldCadenceTime > cadenceTime) { //Hit rollover value
			cadenceTime += (1024 * 64);
		}

		const cadence = ((60 * (cadenceCount - oldCadenceCount) * 1024) / (cadenceTime - oldCadenceTime));
		if (!isNaN(cadence)) {
			state.CalculatedCadence = cadence;
			sensor.emit('cadenceData', state);
		}
	}
}
