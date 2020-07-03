import events = require('events');

import usb = require('usb');

export enum Constants {
	MESSAGE_RF = 0x01,

	MESSAGE_TX_SYNC = 0xA4,
	DEFAULT_NETWORK_NUMBER = 0x00,

	// Configuration messages
	MESSAGE_CHANNEL_UNASSIGN = 0x41,
	MESSAGE_CHANNEL_ASSIGN = 0x42,
	MESSAGE_CHANNEL_ID = 0x51,
	MESSAGE_CHANNEL_PERIOD = 0x43,
	MESSAGE_CHANNEL_SEARCH_TIMEOUT = 0x44,
	MESSAGE_CHANNEL_FREQUENCY = 0x45,
	MESSAGE_CHANNEL_TX_POWER = 0x60,
	MESSAGE_NETWORK_KEY = 0x46,
	MESSAGE_TX_POWER = 0x47,
	MESSAGE_PROXIMITY_SEARCH = 0x71,
	MESSAGE_ENABLE_RX_EXT = 0x66,
	MESSAGE_LIB_CONFIG = 0x6E,
	MESSAGE_CHANNEL_OPEN_RX_SCAN = 0x5B,

	// Notification messages
	MESSAGE_STARTUP = 0x6F,

	// Control messages
	MESSAGE_SYSTEM_RESET = 0x4A,
	MESSAGE_CHANNEL_OPEN = 0x4B,
	MESSAGE_CHANNEL_CLOSE = 0x4C,
	MESSAGE_CHANNEL_REQUEST = 0x4D,

	// Data messages
	MESSAGE_CHANNEL_BROADCAST_DATA = 0x4E,
	MESSAGE_CHANNEL_ACKNOWLEDGED_DATA = 0x4F,
	MESSAGE_CHANNEL_BURST_DATA = 0x50,

	// Channel event messages
	MESSAGE_CHANNEL_EVENT = 0x40,

	// Requested response messages
	MESSAGE_CHANNEL_STATUS = 0x52,
	//MESSAGE_CHANNEL_ID = 0x51,
	MESSAGE_VERSION = 0x3E,
	MESSAGE_CAPABILITIES = 0x54,
	MESSAGE_SERIAL_NUMBER = 0x61,

	// Message parameters
	CHANNEL_TYPE_TWOWAY_RECEIVE = 0x00,
	CHANNEL_TYPE_TWOWAY_TRANSMIT = 0x10,
	CHANNEL_TYPE_SHARED_RECEIVE = 0x20,
	CHANNEL_TYPE_SHARED_TRANSMIT = 0x30,
	CHANNEL_TYPE_ONEWAY_RECEIVE = 0x40,
	CHANNEL_TYPE_ONEWAY_TRANSMIT = 0x50,
	RADIO_TX_POWER_MINUS20DB = 0x00,
	RADIO_TX_POWER_MINUS10DB = 0x01,
	RADIO_TX_POWER_0DB = 0x02,
	RADIO_TX_POWER_PLUS4DB = 0x03,
	RESPONSE_NO_ERROR = 0x00,
	EVENT_RX_SEARCH_TIMEOUT = 0x01,
	EVENT_RX_FAIL = 0x02,
	EVENT_TX = 0x03,
	EVENT_TRANSFER_RX_FAILED = 0x04,
	EVENT_TRANSFER_TX_COMPLETED = 0x05,
	EVENT_TRANSFER_TX_FAILED = 0x06,
	EVENT_CHANNEL_CLOSED = 0x07,
	EVENT_RX_FAIL_GO_TO_SEARCH = 0x08,
	EVENT_CHANNEL_COLLISION = 0x09,
	EVENT_TRANSFER_TX_START = 0x0A,
	CHANNEL_IN_WRONG_STATE = 0x15,
	CHANNEL_NOT_OPENED = 0x16,
	CHANNEL_ID_NOT_SET = 0x18,
	CLOSE_ALL_CHANNELS = 0x19,
	TRANSFER_IN_PROGRESS = 0x1F,
	TRANSFER_SEQUENCE_NUMBER_ERROR = 0x20,
	TRANSFER_IN_ERROR = 0x21,
	MESSAGE_SIZE_EXCEEDS_LIMIT = 0x27,
	INVALID_MESSAGE = 0x28,
	INVALID_NETWORK_NUMBER = 0x29,
	INVALID_LIST_ID = 0x30,
	INVALID_SCAN_TX_CHANNEL = 0x31,
	INVALID_PARAMETER_PROVIDED = 0x33,
	EVENT_QUEUE_OVERFLOW = 0x35,
	USB_STRING_WRITE_FAIL = 0x70,
	CHANNEL_STATE_UNASSIGNED = 0x00,
	CHANNEL_STATE_ASSIGNED = 0x01,
	CHANNEL_STATE_SEARCHING = 0x02,
	CHANNEL_STATE_TRACKING = 0x03,
	CAPABILITIES_NO_RECEIVE_CHANNELS = 0x01,
	CAPABILITIES_NO_TRANSMIT_CHANNELS = 0x02,
	CAPABILITIES_NO_RECEIVE_MESSAGES = 0x04,
	CAPABILITIES_NO_TRANSMIT_MESSAGES = 0x08,
	CAPABILITIES_NO_ACKNOWLEDGED_MESSAGES = 0x10,
	CAPABILITIES_NO_BURST_MESSAGES = 0x20,
	CAPABILITIES_NETWORK_ENABLED = 0x02,
	CAPABILITIES_SERIAL_NUMBER_ENABLED = 0x08,
	CAPABILITIES_PER_CHANNEL_TX_POWER_ENABLED = 0x10,
	CAPABILITIES_LOW_PRIORITY_SEARCH_ENABLED = 0x20,
	CAPABILITIES_SCRIPT_ENABLED = 0x40,
	CAPABILITIES_SEARCH_LIST_ENABLED = 0x80,
	CAPABILITIES_LED_ENABLED = 0x01,
	CAPABILITIES_EXT_MESSAGE_ENABLED = 0x02,
	CAPABILITIES_SCAN_MODE_ENABLED = 0x04,
	CAPABILITIES_PROX_SEARCH_ENABLED = 0x10,
	CAPABILITIES_EXT_ASSIGN_ENABLED = 0x20,
	CAPABILITIES_FS_ANTFS_ENABLED = 0x40,
	TIMEOUT_NEVER = 0xFF,
}

export class Messages {
	static BUFFER_INDEX_MSG_LEN: number = 1;
	static BUFFER_INDEX_MSG_TYPE: number = 2;
	static BUFFER_INDEX_CHANNEL_NUM: number = 3;
	static BUFFER_INDEX_MSG_DATA: number = 4;
	static BUFFER_INDEX_EXT_MSG_BEGIN: number = 12;

	static resetSystem(): Buffer {
		const payload: number[] = [];
		payload.push(0x00);
		return this.buildMessage(payload, Constants.MESSAGE_SYSTEM_RESET);
	}

	static requestMessage(channel: number, messageID: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		payload.push(messageID);
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_REQUEST);
	}

	static setNetworkKey(): Buffer {
		const payload: number[] = [];
		payload.push(Constants.DEFAULT_NETWORK_NUMBER);
		payload.push(0xB9);
		payload.push(0xA5);
		payload.push(0x21);
		payload.push(0xFB);
		payload.push(0xBD);
		payload.push(0x72);
		payload.push(0xC3);
		payload.push(0x45);
		return this.buildMessage(payload, Constants.MESSAGE_NETWORK_KEY);
	}

	static assignChannel(channel: number, type = 'receive'): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		if (type === 'receive') {
			payload.push(Constants.CHANNEL_TYPE_TWOWAY_RECEIVE);
		} else if (type === 'receive_only') {
			payload.push(Constants.CHANNEL_TYPE_ONEWAY_RECEIVE);
		} else if (type === 'receive_shared') {
			payload.push(Constants.CHANNEL_TYPE_SHARED_RECEIVE);
		} else if (type === 'transmit') {
			payload.push(Constants.CHANNEL_TYPE_TWOWAY_TRANSMIT);
		} else if (type === 'transmit_only') {
			payload.push(Constants.CHANNEL_TYPE_ONEWAY_TRANSMIT);
		} else if (type === 'transmit_shared') {
			payload.push(Constants.CHANNEL_TYPE_SHARED_TRANSMIT);
		} else {
			throw 'type not allowed';
		}
		payload.push(Constants.DEFAULT_NETWORK_NUMBER);
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_ASSIGN);
	}

	static setDevice(channel: number, deviceID: number, deviceType: number, transmissionType: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		payload = payload.concat(this.intToLEHexArray(deviceID, 2));
		payload = payload.concat(this.intToLEHexArray(deviceType));
		payload = payload.concat(this.intToLEHexArray(transmissionType));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_ID);
	}

	static searchChannel(channel: number, timeout: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		payload = payload.concat(this.intToLEHexArray(timeout));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_SEARCH_TIMEOUT);
	}

	static setPeriod(channel: number, period: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		payload = payload.concat(this.intToLEHexArray(period));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_PERIOD);
	}

	static setFrequency(channel: number, frequency: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		payload = payload.concat(this.intToLEHexArray(frequency));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_FREQUENCY);
	}

	static setRxExt(): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(0));
		payload = payload.concat(this.intToLEHexArray(1));
		return this.buildMessage(payload, Constants.MESSAGE_ENABLE_RX_EXT);
	}

	static libConfig(channel: number, how: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		payload = payload.concat(this.intToLEHexArray(how));
		return this.buildMessage(payload, Constants.MESSAGE_LIB_CONFIG);
	}

	static openRxScan(): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(0));
		payload = payload.concat(this.intToLEHexArray(1));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_OPEN_RX_SCAN);
	}

	static openChannel(channel: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_OPEN);
	}

	static closeChannel(channel: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_CLOSE);
	}

	static unassignChannel(channel: number): Buffer {
		let payload: number[] = [];
		payload = payload.concat(this.intToLEHexArray(channel));
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_UNASSIGN);
	}

	static acknowledgedData(channel: number, payload: number[]): Buffer {
		payload = this.intToLEHexArray(channel).concat(payload);
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA);
	}

	static broadcastData(channel: number, payload: number[]): Buffer {
		payload = this.intToLEHexArray(channel).concat(payload);
		return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_BROADCAST_DATA);
	}

	static buildMessage(payload: number[] = [], msgID = 0x00): Buffer {
		const m: number[] = [];
		m.push(Constants.MESSAGE_TX_SYNC);
		m.push(payload.length);
		m.push(msgID);
		payload.forEach((byte) => {
			m.push(byte);
		});
		m.push(this.getChecksum(m));
		return Buffer.from(m);
	}

	static intToLEHexArray(int: number, numBytes = 1): number[] {
		numBytes = numBytes || 1;
		const a: number[] = [];
		const b = Buffer.from(this.decimalToHex(int, numBytes * 2), 'hex');
		let i = b.length - 1;
		while (i >= 0) {
			a.push(b[i]);
			i--;
		}
		return a;
	}

	static decimalToHex(d: number, numDigits: number): string {
		let hex = Number(d).toString(16);
		numDigits = numDigits || 2;
		while (hex.length < numDigits) {
			hex = '0' + hex;
		}
		// console.log(hex);
		return hex;
	}

	static getChecksum(message: any[]): number {
		let checksum = 0;
		message.forEach((byte) => {
			checksum = (checksum ^ byte) % 0xFF;
		});
		return checksum;
	}
}

export interface ICancellationToken {
	cancel(): void;
}

class CancellationTokenListener {
	_completed = false;
	constructor(private fn: (d: any) => void, private cb: (err: Error) => void) { }
	cancel() {
		if (!this._completed) {
			this._completed = true;
			// @ts-ignore
			usb.removeListener('attach', this.fn);
			this.cb(new Error('Canceled'));
		}
	}
}

export class USBDriver extends events.EventEmitter {
	private static deviceInUse: usb.Device[] = [];
	private device: usb.Device;
	private iface: usb.Interface;
	private detachedKernelDriver = false;
	private inEp: usb.InEndpoint & events.EventEmitter;
	private outEp: usb.OutEndpoint & events.EventEmitter;
	private leftover: Buffer;
	private usedChannels: number = 0;
	private attachedSensors: BaseSensor[] = [];

	maxChannels: number = 0;
	canScan: boolean = false;

	constructor(private idVendor: number, private idProduct: number, dbgLevel = 0) {
		super();
		this.setMaxListeners(50);
		usb.setDebugLevel(dbgLevel);
	}

	private getDevices() {
		const allDevices = usb.getDeviceList();
		return allDevices
			.filter((d) => d.deviceDescriptor.idVendor === this.idVendor && d.deviceDescriptor.idProduct === this.idProduct)
			.filter(d => USBDriver.deviceInUse.indexOf(d) === -1);
	}

	public is_present(): boolean {
		return this.getDevices().length > 0;
	}

	public open(): boolean {
		const devices = this.getDevices();
		while (devices.length) {
			try {
				this.device = devices.shift();
				this.device.open();
				this.iface = this.device.interfaces[0];
				try {
					if (this.iface.isKernelDriverActive()) {
						this.detachedKernelDriver = true;
						this.iface.detachKernelDriver();
					}
				} catch {
					// Ignore kernel driver errors;
				}
				this.iface.claim();
				break;
			} catch {
				// Ignore the error and try with the next device, if present
				this.device.close();
				this.device = undefined;
				this.iface = undefined;
			}
		}
		if (!this.device) {
			return false;
		}
		USBDriver.deviceInUse.push(this.device);

		this.inEp = this.iface.endpoints[0] as usb.InEndpoint;

		this.inEp.on('data', (data: Buffer) => {
			if (!data.length) {
				return;
			}

			if (this.leftover) {
				data = Buffer.concat([this.leftover, data]);
				this.leftover = undefined;
			}

			if (data.readUInt8(0) !== 0xA4) {
				throw 'SYNC missing';
			}

			const len = data.length;
			let beginBlock = 0;
			while (beginBlock < len) {
				if (beginBlock + 1 === len) {
					this.leftover = data.slice(beginBlock);
					break;
				}
				const blockLen = data.readUInt8(beginBlock + 1);
				const endBlock = beginBlock + blockLen + 4;
				if (endBlock > len) {
					this.leftover = data.slice(beginBlock);
					break;
				}
				const readData = data.slice(beginBlock, endBlock);
				this.read(readData);
				beginBlock = endBlock;
			}
		});

		this.inEp.on('error', (err: any) => {
			//console.log('ERROR RECV: ', err);
		});

		this.inEp.on('end', () => {
			//console.log('STOP RECV');
		});

		this.inEp.startPoll();

		this.outEp = this.iface.endpoints[1] as usb.OutEndpoint;

		this.reset();

		return true;
	}

	public openAsync(cb: (err: Error) => void): ICancellationToken {
		let ct: CancellationTokenListener;
		const doOpen = () => {
			try {
				const result = this.open();
				if (result) {
					ct._completed = true;
					try {
						cb(undefined);
					} catch {
						// ignore errors
					}
				} else {
					return false;
				}
			} catch (err) {
				cb(err);
			}
			return true;
		};
		const fn = (d) => {
			if (!d || (d.deviceDescriptor.idVendor === this.idVendor && d.deviceDescriptor.idProduct === this.idProduct)) {
				if (doOpen()) {
					// @ts-ignore
					usb.removeListener('attach', fn);
				}
			}
		};
		usb.on('attach', fn);
		if (this.is_present()) {
			// @ts-ignore
			setImmediate(() => usb.emit('attach', this.device));
		}
		return ct = new CancellationTokenListener(fn, cb);
	}

	public close() {
		this.detach_all();
		this.inEp.stopPoll(() => {
			// @ts-ignore
			this.iface.release(true, () => {
				if (this.detachedKernelDriver) {
					this.detachedKernelDriver = false;
					try {
						this.iface.attachKernelDriver();
					} catch {
						// Ignore kernel driver errors;
					}
				}
				this.iface = undefined;
				this.device.reset(() => {
					this.device.close();
					this.emit('shutdown');
					const devIdx = USBDriver.deviceInUse.indexOf(this.device);
					if (devIdx >= 0) {
						USBDriver.deviceInUse.splice(devIdx, 1);
					}
					// @ts-ignore
					if (usb.listenerCount('attach')) {
						// @ts-ignore
						usb.emit('attach', this.device);
					}
					this.device = undefined;
				});
			});
		});
	}

	public reset() {
		this.detach_all();
		this.maxChannels = 0;
		this.usedChannels = 0;
		this.write(Messages.resetSystem());
	}

	public isScanning(): boolean {
		return this.usedChannels === -1;
	}

	public attach(sensor: BaseSensor, forScan: boolean): boolean {
		if (this.usedChannels < 0) {
			return false;
		}
		if (forScan) {
			if (this.usedChannels !== 0) {
				return false;
			}
			this.usedChannels = -1;
		} else {
			if (this.maxChannels <= this.usedChannels) {
				return false;
			}
			++this.usedChannels;
		}
		this.attachedSensors.push(sensor);
		return true;
	}

	public detach(sensor: BaseSensor): boolean {
		const idx = this.attachedSensors.indexOf(sensor);
		if (idx < 0) {
			return false;
		}
		if (this.usedChannels < 0) {
			this.usedChannels = 0;
		} else {
			--this.usedChannels;
		}
		this.attachedSensors.splice(idx, 1);
		return true;
	}

	public detach_all() {
		const copy = this.attachedSensors;
		copy.forEach((sensor: BaseSensor) => sensor.detach());
	}

	public write(data: Buffer) {
		//console.log('DATA SEND: ', data);
		this.outEp.transfer(data, (error) => {
			if (error) {
				//console.log('ERROR SEND: ', error);
			}
		});
	}

	public read(data: Buffer) {
		//console.log('DATA RECV: ', data);
		const messageID = data.readUInt8(2);
		if (messageID === Constants.MESSAGE_STARTUP) {
			this.write(Messages.requestMessage(0, Constants.MESSAGE_CAPABILITIES));
		} else if (messageID === Constants.MESSAGE_CAPABILITIES) {
			this.maxChannels = data.readUInt8(3);
			this.canScan = (data.readUInt8(7) & 0x06) === 0x06;
			this.write(Messages.setNetworkKey());
		} else if (messageID === Constants.MESSAGE_CHANNEL_EVENT && data.readUInt8(4) === Constants.MESSAGE_NETWORK_KEY) {
			this.emit('startup', data);
		} else {
			this.emit('read', data);
		}
	}
}

export class GarminStick2 extends USBDriver {
	constructor(dbgLevel = 0) {
		super(0x0fcf, 0x1008, dbgLevel);
	}
}

export class GarminStick3 extends USBDriver {
	constructor(dbgLevel = 0) {
		super(0x0fcf, 0x1009, dbgLevel);
	}
}

export type SendCallback = (result: boolean) => void;

export abstract class BaseSensor extends events.EventEmitter {
	channel: number;
	deviceID: number;
	transmissionType: number;

	private msgQueue: { msg: Buffer, cbk?: SendCallback }[] = [];

	protected decodeDataCbk: (data: Buffer) => void;
	protected statusCbk: (status: { msg: number, code: number }) => boolean;

	protected abstract updateState(deviceId: number, data: Buffer): void;

	constructor(private stick: USBDriver) {
		super();
		stick.on('read', this.handleEventMessages.bind(this));
	}

	protected scan(type: string, frequency: number) {
		if (this.channel !== undefined) {
			throw 'already attached';
		}

		if (!this.stick.canScan) {
			throw 'stick cannot scan';
		}

		const channel = 0;

		const onStatus = (status) => {
			switch (status.msg) {
				case Constants.MESSAGE_RF:
					switch (status.code) {
						case Constants.EVENT_CHANNEL_CLOSED:
						case Constants.EVENT_RX_FAIL_GO_TO_SEARCH:
							this.write(Messages.unassignChannel(channel));
							return true;
						case Constants.EVENT_TRANSFER_TX_COMPLETED:
						case Constants.EVENT_TRANSFER_TX_FAILED:
						case Constants.EVENT_RX_FAIL:
						case Constants.INVALID_SCAN_TX_CHANNEL:
							const mc = this.msgQueue.shift();
							if (mc && mc.cbk) {
								mc.cbk(status.code === Constants.EVENT_TRANSFER_TX_COMPLETED);
							}
							if (this.msgQueue.length) {
								this.write(this.msgQueue[0].msg);
							}
							return true;
						default:
							break;
					}
					break;
				case Constants.MESSAGE_CHANNEL_ASSIGN:
					this.write(Messages.setDevice(channel, 0, 0, 0));
					return true;
				case Constants.MESSAGE_CHANNEL_ID:
					this.write(Messages.setFrequency(channel, frequency));
					return true;
				case Constants.MESSAGE_CHANNEL_FREQUENCY:
					this.write(Messages.setRxExt());
					return true;
				case Constants.MESSAGE_ENABLE_RX_EXT:
					this.write(Messages.libConfig(channel, 0xE0));
					return true;
				case Constants.MESSAGE_LIB_CONFIG:
					this.write(Messages.openRxScan());
					return true;
				case Constants.MESSAGE_CHANNEL_OPEN_RX_SCAN:
					process.nextTick(() => this.emit('attached'));
					return true;
				case Constants.MESSAGE_CHANNEL_CLOSE:
					return true;
				case Constants.MESSAGE_CHANNEL_UNASSIGN:
					this.statusCbk = undefined;
					this.channel = undefined;
					process.nextTick(() => this.emit('detached'));
					return true;
				case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
					return (status.code === Constants.TRANSFER_IN_PROGRESS);
				default:
					break;
			}
			return false;
		};

		if (this.stick.isScanning()) {
			this.channel = channel;
			this.deviceID = 0;
			this.transmissionType = 0;

			this.statusCbk = onStatus;

			process.nextTick(() => this.emit('attached'));
		} else if (this.stick.attach(this, true)) {
			this.channel = channel;
			this.deviceID = 0;
			this.transmissionType = 0;

			this.statusCbk = onStatus;

			this.write(Messages.assignChannel(channel, type));
		} else {
			throw 'cannot attach';
		}
	}

	protected attach(channel: number, type: string, deviceID: number, deviceType: number, transmissionType: number,
		timeout: number, period: number, frequency: number) {
		if (this.channel !== undefined) {
			throw 'already attached';
		}
		if (!this.stick.attach(this, false)) {
			throw 'cannot attach';
		}
		this.channel = channel;
		this.deviceID = deviceID;
		this.transmissionType = transmissionType;

		const onStatus = (status) => {
			switch (status.msg) {
				case Constants.MESSAGE_RF:
					switch (status.code) {
						case Constants.EVENT_CHANNEL_CLOSED:
						case Constants.EVENT_RX_FAIL_GO_TO_SEARCH:
							this.write(Messages.unassignChannel(channel));
							return true;
						case Constants.EVENT_TRANSFER_TX_COMPLETED:
						case Constants.EVENT_TRANSFER_TX_FAILED:
						case Constants.EVENT_RX_FAIL:
						case Constants.INVALID_SCAN_TX_CHANNEL:
							const mc = this.msgQueue.shift();
							if (mc && mc.cbk) {
								mc.cbk(status.code === Constants.EVENT_TRANSFER_TX_COMPLETED);
							}
							if (this.msgQueue.length) {
								this.write(this.msgQueue[0].msg);
							}
							return true;
						case Constants.EVENT_CHANNEL_COLLISION:
							return true; // collision is not an error on multi-channel networks
						default:
							break;
					}
					break;
				case Constants.MESSAGE_CHANNEL_ASSIGN:
					this.write(Messages.setDevice(channel, deviceID, deviceType, transmissionType));
					return true;
				case Constants.MESSAGE_CHANNEL_ID:
					this.write(Messages.searchChannel(channel, timeout));
					return true;
				case Constants.MESSAGE_CHANNEL_SEARCH_TIMEOUT:
					this.write(Messages.setFrequency(channel, frequency));
					return true;
				case Constants.MESSAGE_CHANNEL_FREQUENCY:
					this.write(Messages.setPeriod(channel, period));
					return true;
				case Constants.MESSAGE_CHANNEL_PERIOD:
					this.write(Messages.libConfig(channel, 0xE0));
					return true;
				case Constants.MESSAGE_LIB_CONFIG:
					this.write(Messages.openChannel(channel));
					return true;
				case Constants.MESSAGE_CHANNEL_OPEN:
					process.nextTick(() => this.emit('attached'));
					return true;
				case Constants.MESSAGE_CHANNEL_CLOSE:
					return true;
				case Constants.MESSAGE_CHANNEL_UNASSIGN:
					this.statusCbk = undefined;
					this.channel = undefined;
					process.nextTick(() => this.emit('detached'));
					return true;
				case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
					return (status.code === Constants.TRANSFER_IN_PROGRESS);
				default:
					break;
			}
			return false;
		};

		this.statusCbk = onStatus;

		this.write(Messages.assignChannel(channel, type));
	}

	public detach() {
		if (this.channel === undefined) {
			return;
		}
		this.write(Messages.closeChannel(this.channel));
		if (!this.stick.detach(this)) {
			throw 'error detaching';
		}
	}

	protected write(data: Buffer) {
		this.stick.write(data);
	}

	private handleEventMessages(data: Buffer) {
		const messageID = data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE);
		const channel = data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM);

		if (channel === this.channel) {
			if (messageID === Constants.MESSAGE_CHANNEL_EVENT) {
				const status = {
					msg: data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA),
					code: data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1),
				};

				const handled = this.statusCbk && this.statusCbk(status);
				if (!handled) {
					console.log('Unhandled event: ' + data.toString('hex'));
					this.emit('eventData', {
						message: data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA),
						code: data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1),
					});
				}
			} else if (this.decodeDataCbk) {
				this.decodeDataCbk(data);
			}
		}
	}

	protected send(data: Buffer, cbk?: SendCallback) {
		this.msgQueue.push({ msg: data, cbk });
		if (this.msgQueue.length === 1) {
			this.write(data);
		}
	}
}

export abstract class AntPlusBaseSensor extends BaseSensor {

	protected scan(type: string) {
		return super.scan(type, 57);
	}

	protected attach(channel: number, type: string, deviceID: number, deviceType: number, transmissionType: number,
		timeout: number, period: number) {
		return super.attach(channel, type, deviceID, deviceType, transmissionType, timeout, period, 57);
	}
}

export abstract class AntPlusSensor extends AntPlusBaseSensor {

	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	protected scan() {
		throw 'scanning unsupported';
	}

	protected attach(channel: number, type: string, deviceID: number, deviceType: number, transmissionType: number,
		timeout: number, period: number) {
		return super.attach(channel, type, deviceID, deviceType, transmissionType, timeout, period);
	}

	private decodeData(data: Buffer) {
		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				if (this.deviceID === 0) {
					this.write(Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID));
				}
				this.updateState(this.deviceID, data);
				break;
			case Constants.MESSAGE_CHANNEL_ID:
				this.deviceID = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
				this.transmissionType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				break;
			default:
				break;
		}
	}
}

export abstract class AntPlusScanner extends AntPlusBaseSensor {

	protected abstract deviceType(): number;
	protected abstract createStateIfNew(deviceId: number): void;
	protected abstract updateRssiAndThreshold(deviceId: number, rssi: number, threshold: number): void;

	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	public scan() {
		return super.scan('receive');
	}

	protected attach() {
		throw 'attach unsupported';
	}

	protected send() {
		throw 'send unsupported';
	}

	private decodeData(data: Buffer) {
		if (data.length <= (Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3) || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format', data.toString('hex'));
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== this.deviceType()) {
			return;
		}

		this.createStateIfNew(deviceId);

		if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
			if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
				this.updateRssiAndThreshold(
					deviceId,
					data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6),
					data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7));
			}
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
			case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
			case Constants.MESSAGE_CHANNEL_BURST_DATA:
				this.updateState(deviceId, data);
				break;
			default:
				break;
		}
	}
}
