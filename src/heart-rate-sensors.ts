/// <reference path="../typings/index.d.ts"/>

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
	OperatingTime: number;
	ManId: number;
	SerialNumber: number;
	HwVersion: number;
	SwVersion: number;
	ModelNum: number;
	PreviousBeat: number;
	Rssi: number;
	Threshold: number;
}

class HeartRateScannerState extends HeartRateSensorState {
	Rssi: number;
	Threshold: number;
}

enum PageState { INIT_PAGE, STD_PAGE, EXT_PAGE }

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

	state: HeartRateSensorState;

	private oldPage: number;
	private pageState: PageState = PageState.INIT_PAGE; // sets the state of the receiver - INIT, STD_PAGE, EXT_PAGE

	private static TOGGLE_MASK = 0x80;

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
				if (this.pageState === PageState.INIT_PAGE) {
					this.pageState = PageState.STD_PAGE; // change the state to STD_PAGE and allow the checking of old and new pages
					// decode with pages if the page byte or toggle bit has changed
				} else if ((page !== this.oldPage) || (this.pageState === PageState.EXT_PAGE)) {
					this.pageState = PageState.EXT_PAGE; // set the state to use the extended page format
					switch (page & ~HeartRateSensor.TOGGLE_MASK) { //check the new pages and remove the toggle bit
						case 1:
							//decode the cumulative operating time
							this.state.OperatingTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
							this.state.OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2) << 8;
							this.state.OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 16;
							this.state.OperatingTime *= 2;
							break;
						case 2:
							//decode the Manufacturer ID
							this.state.ManId = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
							//decode the 4 byte serial number
							this.state.SerialNumber = this.deviceID;
							this.state.SerialNumber |= data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2) << 16;
							this.state.SerialNumber >>>= 0;
							break;
						case 3:
							//decode HW version, SW version, and model number
							this.state.HwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
							this.state.SwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
							this.state.ModelNum = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
							break;
						case 4:
							//decode the previous heart beat measurement time
							this.state.PreviousBeat = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2);
							break;
						default:
							break;
					}
				}
				// decode the last four bytes of the HRM format, the first byte of this message is the channel number
				this.DecodeDefaultHRM(data.slice(Messages.BUFFER_INDEX_MSG_DATA + 4));
				this.oldPage = page;
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

	private DecodeDefaultHRM(pucPayload: Buffer) {
		// decode the measurement time data (two bytes)
		this.state.BeatTime = pucPayload.readUInt16LE(0);
		// decode the measurement count data
		this.state.BeatCount = pucPayload.readUInt8(2);
		// decode the measurement count data
		this.state.ComputedHeartRate = pucPayload.readUInt8(3);

		this.emit('hbdata', this.state);
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

	states: { [id: number]: HeartRateScannerState } = {};

	private oldPage: number;
	private pageState: PageState = PageState.INIT_PAGE;

	private static TOGGLE_MASK = 0x80;

	decodeData(data: Buffer) {
		if (!(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		let deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		let deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== HeartRateScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new HeartRateScannerState(deviceId);
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
				if (this.pageState === PageState.INIT_PAGE) {
					this.pageState = PageState.STD_PAGE; // change the state to STD_PAGE and allow the checking of old and new pages
					// decode with pages if the page byte or toggle bit has changed
				} else if ((page !== this.oldPage) || (this.pageState === PageState.EXT_PAGE)) {
					this.pageState = PageState.EXT_PAGE; // set the state to use the extended page format
					switch (page & ~HeartRateScanner.TOGGLE_MASK) { //check the new pages and remove the toggle bit
						case 1:
							//decode the cumulative operating time
							this.states[deviceId].OperatingTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
							this.states[deviceId].OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2) << 8;
							this.states[deviceId].OperatingTime |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 16;
							this.states[deviceId].OperatingTime *= 2;
							break;
						case 2:
							//decode the Manufacturer ID
							this.states[deviceId].ManId = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
							//decode the 4 byte serial number
							this.states[deviceId].SerialNumber = this.deviceID;
							this.states[deviceId].SerialNumber |= data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2) << 16;
							this.states[deviceId].SerialNumber >>>= 0;
							break;
						case 3:
							//decode HW version, SW version, and model number
							this.states[deviceId].HwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
							this.states[deviceId].SwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
							this.states[deviceId].ModelNum = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
							break;
						case 4:
							//decode the previous heart beat measurement time
							this.states[deviceId].PreviousBeat = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2);
							break;
						default:
							break;
					}
				}
				// decode the last four bytes of the HRM format, the first byte of this message is the channel number
				this.DecodeDefaultHRM(deviceId, data.slice(Messages.BUFFER_INDEX_MSG_DATA + 4));
				this.oldPage = page;
				break;
			default:
				break;
		}
	}

	private DecodeDefaultHRM(deviceId: number, pucPayload: Buffer) {
		// decode the measurement time data (two bytes)
		this.states[deviceId].BeatTime = pucPayload.readUInt16LE(0);
		// decode the measurement count data
		this.states[deviceId].BeatCount = pucPayload.readUInt8(2);
		// decode the measurement count data
		this.states[deviceId].ComputedHeartRate = pucPayload.readUInt8(3);

		this.emit('hbdata', this.states[deviceId]);
	}
}
