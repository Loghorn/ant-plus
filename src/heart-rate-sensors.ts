/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#526_tab
 * Spec sheet: https://www.thisisant.com/resources/heart-rate-monitor/
 */

import Ant = require('./ant');

const Constants = Ant.Constants;
const Messages = Ant.Messages;

class HeartRateSensorState {
	constructor(deviceId: number) {
		this.DeviceID = deviceId;
	}

	DeviceID: number;
	BeatTime: number;
	BeatCount: number;
	ComputedHeartRate: number;
	OperatingTime?: number;
	ManId: number;
	SerialNumber: number;
	HwVersion: number;
	SwVersion: number;
	ModelNum: number;
	PreviousBeat: number;

	IntervalAverage?: number;
	IntervalMax?: number;
	SessionAverage?: number;
	SupportedFeatures?: number;
	EnabledFeatures?: number;
	BatteryLevel?: number;
	BatteryVoltage?: number;
	BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';
}

class HeartRateScannerState extends HeartRateSensorState {
	Rssi: number;
	Threshold: number;
}

enum PageState { INIT_PAGE, STD_PAGE, EXT_PAGE }

type Page = {
	oldPage: number;
	pageState: PageState // sets the state of the receiver - INIT, STD_PAGE, EXT_PAGE
};

export class HeartRateSensor extends Ant.AntPlusSensor {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 120;

	public attach(channel, deviceID) {
		super.attach(channel, 'receive', deviceID, HeartRateSensor.deviceType, 0, 255, 8070);
		this.state = new HeartRateSensorState(deviceID);
	}

	private state: HeartRateSensorState;

	private page: Page = {
		oldPage: -1,
		pageState: PageState.INIT_PAGE,
	};

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

				updateState(this, this.state, this.page, data);
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

export class HeartRateScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 120;

	public scan() {
		super.scan('receive');
	}

	private states: { [id: number]: HeartRateScannerState } = {};

	private pages: { [id: number]: Page } = {};

	decodeData(data: Buffer) {
		if (data.length <= (Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3) || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== HeartRateScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new HeartRateScannerState(deviceId);
		}

		if (!this.pages[deviceId]) {
			this.pages[deviceId] = { oldPage: -1, pageState: PageState.INIT_PAGE };
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
				updateState(this, this.states[deviceId], this.pages[deviceId], data);
				break;
			default:
				break;
		}
	}
}

const TOGGLE_MASK = 0x80;

function updateState(
	sensor: HeartRateSensor | HeartRateScanner,
	state: HeartRateSensorState | HeartRateScannerState,
	page: Page,
	data: Buffer) {

	const pageNum = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	if (page.pageState === PageState.INIT_PAGE) {
		page.pageState = PageState.STD_PAGE; // change the state to STD_PAGE and allow the checking of old and new pages
		// decode with pages if the page byte or toggle bit has changed
	} else if ((pageNum !== page.oldPage) || (page.pageState === PageState.EXT_PAGE)) {
		page.pageState = PageState.EXT_PAGE; // set the state to use the extended page format
		switch (pageNum & ~TOGGLE_MASK) { //check the new pages and remove the toggle bit
			case 1:
				console.log(1);
				//decode the cumulative operating time
				state.OperatingTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
				state.OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2) << 8;
				state.OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 16;
				state.OperatingTime *= 2;
				break;
			case 2:
				console.log(2);
				//decode the Manufacturer ID
				state.ManId = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
				//decode the 4 byte serial number
				state.SerialNumber = sensor.deviceID;
				state.SerialNumber |= data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2) << 16;
				state.SerialNumber >>>= 0;
				break;
			case 3:
				console.log(3);
				//decode HW version, SW version, and model number
				state.HwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
				state.SwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
				state.ModelNum = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				break;
			case 4:
				console.log(4);
				//decode the previous heart beat measurement time
				state.PreviousBeat = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2);
				break;
			case 5:
				console.log(5);
				state.IntervalAverage = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
				state.IntervalMax = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
				state.SessionAverage = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				break;
			case 6:
				console.log(6);
				state.SupportedFeatures = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
				state.EnabledFeatures = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				break;
			case 7:
				console.log(7);
				const batteryLevel = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
				const batteryFrac = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
				const batteryStatus = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				if (batteryLevel !== 0xFF) {
					state.BatteryLevel = batteryLevel;
				}
				state.BatteryVoltage = (batteryStatus & 0x0F) + (batteryFrac / 256);
				const batteryFlags = batteryStatus & 0x70;
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
			default:
				break;
		}
	}
	// decode the last four bytes of the HRM format, the first byte of this message is the channel number
	DecodeDefaultHRM(state, data.slice(Messages.BUFFER_INDEX_MSG_DATA + 4));
	page.oldPage = pageNum;

	sensor.emit('hbdata', state);
	sensor.emit('hbData', state);
}

function DecodeDefaultHRM(state: HeartRateSensorState | HeartRateScannerState, pucPayload: Buffer) {
	// decode the measurement time data (two bytes)
	state.BeatTime = pucPayload.readUInt16LE(0);
	// decode the measurement count data
	state.BeatCount = pucPayload.readUInt8(2);
	// decode the measurement count data
	state.ComputedHeartRate = pucPayload.readUInt8(3);
}
