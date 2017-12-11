/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import Ant = require('./ant');

const Constants = Ant.Constants;
const Messages = Ant.Messages;

class FitnessEquipmentSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	temperature?: number;
	zeroOffset?: number;
	spinDownTime?: number;

	equipmentType?: 'Treadmill' | 'Elliptical' | 'StationaryBike' | 'Rower' | 'Climber' | 'NordicSkier' | 'Trainer' | 'General';
	elapsedTime?: number;
	distance?: number;
	realSpeed?: number;
	virtualSpeed?: number;
	heartRate?: number;
	heartRateSource?: 'HandContact' | 'EM' | 'ANT+';
	state?: 'OFF' | 'READY' | 'IN_USE' | 'FINISHED';

	cycleLength?: number;
	incline?: number;
	resistance?: number;

	METs?: number;
	caloricBurnRate?: number;
	calories?: number;

	_EventCount0x19?: number;
	cadence?: number;
	accumulatedPower?: number;
	instantaneousPower?: number;
	averagePower?: number;
	trainerStatus?: number;
	targetStatus?: 'OnTarget' | 'LowSpeed' | 'HighSpeed';

	hwRevision?: number;
	manufacturerId?: number;
	modelNumber?: number;

	softwareRevision?: number;
	serial?: number;

	pairedDevices: any[] = [];
}

class FitnessEquipmentScanState extends FitnessEquipmentSensorState {
	Rssi: number;
	Threshold: number;
}

export class FitnessEquipmentSensor extends Ant.AntPlusSensor {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x11;

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, FitnessEquipmentSensor.deviceType, 0, 255, 8192);
		this.state = new FitnessEquipmentSensorState(deviceID);
	}

	private state: FitnessEquipmentSensorState;

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

export class FitnessEquipmentScanner extends Ant.AntPlusScanner {
	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	static deviceType = 0x11;

	public scan() {
		super.scan('receive');
	}

	private states: { [id: number]: FitnessEquipmentScanState } = {};

	decodeData(data: Buffer) {
		if (data.length <= Messages.BUFFER_INDEX_EXT_MSG_BEGIN || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== FitnessEquipmentScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new FitnessEquipmentScanState(deviceId);
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

function resetState(state: FitnessEquipmentSensorState | FitnessEquipmentScanState) {
	delete state.elapsedTime;
	delete state.distance;
	delete state.realSpeed;
	delete state.virtualSpeed;
	delete state.heartRate;
	delete state.heartRateSource;
	delete state.cycleLength;
	delete state.incline;
	delete state.resistance;
	delete state.METs;
	delete state.caloricBurnRate;
	delete state.calories;
	delete state._EventCount0x19;
	delete state.cadence;
	delete state.accumulatedPower;
	delete state.instantaneousPower;
	delete state.averagePower;
	delete state.trainerStatus;
	delete state.targetStatus;
}

function updateState(
	sensor: FitnessEquipmentSensor | FitnessEquipmentScanner,
	state: FitnessEquipmentSensorState | FitnessEquipmentScanState,
	data: Buffer) {

	const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	switch (page) {
		case 0x01: {
			const temperature = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			if (temperature !== 0xFF) {
				state.temperature = -25 + temperature * 0.5;
			}
			const calBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			if (calBF & 0x40) {
				state.zeroOffset = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			}
			if (calBF & 0x80) {
				state.spinDownTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
			}
			break;
		}
		case 0x10: {
			const equipmentTypeBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			switch (equipmentTypeBF & 0x1F) {
				case 19: state.equipmentType = 'Treadmill'; break;
				case 20: state.equipmentType = 'Elliptical'; break;
				case 21: state.equipmentType = 'StationaryBike'; break;
				case 22: state.equipmentType = 'Rower'; break;
				case 23: state.equipmentType = 'Climber'; break;
				case 24: state.equipmentType = 'NordicSkier'; break;
				case 25: state.equipmentType = 'Trainer'; break;
				default: state.equipmentType = 'General'; break;
			}
			let elapsedTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			let distance = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const speed = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const heartRate = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const capStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
			if (heartRate !== 0xFF) {
				switch (capStateBF & 0x03) {
					case 3: {
						state.heartRate = heartRate;
						state.heartRateSource = 'HandContact';
						break;
					}
					case 2: {
						state.heartRate = heartRate;
						state.heartRateSource = 'EM';
						break;
					}
					case 1: {
						state.heartRate = heartRate;
						state.heartRateSource = 'ANT+';
						break;
					}
					default: {
						delete state.heartRate;
						delete state.heartRateSource;
						break;
					}
				}
			}

			elapsedTime /= 4;
			const oldElapsedTime = (state.elapsedTime || 0) % 64;
			if (elapsedTime !== oldElapsedTime) {
				if (oldElapsedTime > elapsedTime) { //Hit rollover value
					elapsedTime += 64;
				}
			}
			state.elapsedTime = (state.elapsedTime || 0) + elapsedTime - oldElapsedTime;

			if (capStateBF & 0x04) {
				const oldDistance = (state.distance || 0) % 256;
				if (distance !== oldDistance) {
					if (oldDistance > distance) { //Hit rollover value
						distance += 256;
					}
				}
				state.distance = (state.distance || 0) + distance - oldDistance;
			} else {
				delete state.distance;
			}
			if (capStateBF & 0x08) {
				state.virtualSpeed = speed / 1000;
				delete state.realSpeed;
			} else {
				delete state.virtualSpeed;
				state.realSpeed = speed / 1000;
			}
			switch ((capStateBF & 0x70) >> 4) {
				case 1: state.state = 'OFF'; break;
				case 2: state.state = 'READY'; resetState(state); break;
				case 3: state.state = 'IN_USE'; break;
				case 4: state.state = 'FINISHED'; break;
				default: delete state.state; break;
			}
			if (capStateBF & 0x80) {
				// lap
			}
			break;
		}
		case 0x11: {
			const cycleLen = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const incline = data.readInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const resistance = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const capStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
			if (cycleLen !== 0xFF) {
				state.cycleLength = cycleLen / 100;
			}
			if (incline >= -10000 && incline <= 10000) {
				state.incline = incline / 100;
			}
			if (resistance !== 0xFF) {
				state.resistance = resistance;
			}
			switch ((capStateBF & 0x70) >> 4) {
				case 1: state.state = 'OFF'; break;
				case 2: state.state = 'READY'; resetState(state); break;
				case 3: state.state = 'IN_USE'; break;
				case 4: state.state = 'FINISHED'; break;
				default: delete state.state; break;
			}
			if (capStateBF & 0x80) {
				// lap
			}
			break;
		}
		case 0x12: {
			const mets = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const caloricbr = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const calories = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const capStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
			if (mets !== 0xFFFF) {
				state.METs = mets / 100;
			}
			if (caloricbr !== 0xFFFF) {
				state.caloricBurnRate = caloricbr / 10;
			}
			if (capStateBF & 0x01) {
				state.calories = calories;
			}
			switch ((capStateBF & 0x70) >> 4) {
				case 1: state.state = 'OFF'; break;
				case 2: state.state = 'READY'; resetState(state); break;
				case 3: state.state = 'IN_USE'; break;
				case 4: state.state = 'FINISHED'; break;
				default: delete state.state; break;
			}
			if (capStateBF & 0x80) {
				// lap
			}
			break;
		}
		case 0x19: {
			const oldEventCount = state._EventCount0x19 || 0;

			let eventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			let accPower = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5) & 0xFFF;
			const trainerStatus = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6) >> 4;
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (eventCount !== oldEventCount) {
				state._EventCount0x19 = eventCount;
				if (oldEventCount > eventCount) { //Hit rollover value
					eventCount += 255;
				}
			}

			if (cadence !== 0xFF) {
				state.cadence = cadence;
			}

			if (power !== 0xFFF) {
				state.instantaneousPower = power;

				const oldAccPower = (state.accumulatedPower || 0) % 65536;
				if (accPower !== oldAccPower) {
					if (oldAccPower > accPower) {
						accPower += 65536;
					}
				}
				state.accumulatedPower = (state.accumulatedPower || 0) + accPower - oldAccPower;

				state.averagePower = (accPower - oldAccPower) / (eventCount - oldEventCount);
			}

			state.trainerStatus = trainerStatus;

			switch (flagStateBF & 0x03) {
				case 0: state.targetStatus = 'OnTarget'; break;
				case 1: state.targetStatus = 'LowSpeed'; break;
				case 2: state.targetStatus = 'HighSpeed'; break;
				default: delete state.targetStatus; break;
			}

			switch ((flagStateBF & 0x70) >> 4) {
				case 1: state.state = 'OFF'; break;
				case 2: state.state = 'READY'; resetState(state); break;
				case 3: state.state = 'IN_USE'; break;
				case 4: state.state = 'FINISHED'; break;
				default: delete state.state; break;
			}
			if (flagStateBF & 0x80) {
				// lap
			}

			break;
		}
		case 0x50: {
			state.hwRevision = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			state.manufacturerId = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			state.modelNumber = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
			break;
		}
		case 0x51: {
			const swRevSup = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const swRevMain = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const serial = data.readInt32LE(Messages.BUFFER_INDEX_MSG_DATA + 4);

			state.softwareRevision = swRevMain;

			if (swRevSup !== 0xFF) {
				state.softwareRevision += swRevSup / 1000;
			}

			if (serial !== 0xFFFFFFFF) {
				state.serial = serial;
			}

			break;
		}
		case 0x56: {
			const idx = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			const tot = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const chState = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const devId = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const trType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const devType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (idx === 0) {
				state.pairedDevices = [];
			}

			if (tot > 0) {
				state.pairedDevices.push({ id: devId, type: devType, paired: (chState & 0x80) ? true : false });
			}

			break;
		}
		default:
			return;
	}
	sensor.emit('fitnessData', state);
}
