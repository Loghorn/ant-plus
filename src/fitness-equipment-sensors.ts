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
	Temperature?: number;
	ZeroOffset?: number;
	SpinDownTime?: number;

	EquipmentType?: 'Treadmill' | 'Elliptical' | 'StationaryBike' | 'Rower' | 'Climber' | 'NordicSkier' | 'Trainer' | 'General';
	ElapsedTime?: number;
	Distance?: number;
	RealSpeed?: number;
	VirtualSpeed?: number;
	HeartRate?: number;
	HeartRateSource?: 'HandContact' | 'EM' | 'ANT+';
	State?: 'OFF' | 'READY' | 'IN_USE' | 'FINISHED';

	CycleLength?: number;
	Incline?: number;
	Resistance?: number;

	METs?: number;
	CaloricBurnRate?: number;
	Calories?: number;

	_EventCount0x19?: number;
	Cadence?: number;
	AccumulatedPower?: number;
	InstantaneousPower?: number;
	AveragePower?: number;
	TrainerStatus?: number;
	TargetStatus?: 'OnTarget' | 'LowSpeed' | 'HighSpeed';

	HwVersion?: number;
	ManId?: number;
	ModelNum?: number;

	SwVersion?: number;
	SerialNumber?: number;

	PairedDevices: any[] = [];
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
	delete state.ElapsedTime;
	delete state.Distance;
	delete state.RealSpeed;
	delete state.VirtualSpeed;
	delete state.HeartRate;
	delete state.HeartRateSource;
	delete state.CycleLength;
	delete state.Incline;
	delete state.Resistance;
	delete state.METs;
	delete state.CaloricBurnRate;
	delete state.Calories;
	delete state._EventCount0x19;
	delete state.Cadence;
	delete state.AccumulatedPower;
	delete state.InstantaneousPower;
	delete state.AveragePower;
	delete state.TrainerStatus;
	delete state.TargetStatus;
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
				state.Temperature = -25 + temperature * 0.5;
			}
			const calBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			if (calBF & 0x40) {
				state.ZeroOffset = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			}
			if (calBF & 0x80) {
				state.SpinDownTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
			}
			break;
		}
		case 0x10: {
			const equipmentTypeBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			switch (equipmentTypeBF & 0x1F) {
				case 19: state.EquipmentType = 'Treadmill'; break;
				case 20: state.EquipmentType = 'Elliptical'; break;
				case 21: state.EquipmentType = 'StationaryBike'; break;
				case 22: state.EquipmentType = 'Rower'; break;
				case 23: state.EquipmentType = 'Climber'; break;
				case 24: state.EquipmentType = 'NordicSkier'; break;
				case 25: state.EquipmentType = 'Trainer'; break;
				default: state.EquipmentType = 'General'; break;
			}
			let elapsedTime = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			let distance = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const speed = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const heartRate = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const capStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);
			if (heartRate !== 0xFF) {
				switch (capStateBF & 0x03) {
					case 3: {
						state.HeartRate = heartRate;
						state.HeartRateSource = 'HandContact';
						break;
					}
					case 2: {
						state.HeartRate = heartRate;
						state.HeartRateSource = 'EM';
						break;
					}
					case 1: {
						state.HeartRate = heartRate;
						state.HeartRateSource = 'ANT+';
						break;
					}
					default: {
						delete state.HeartRate;
						delete state.HeartRateSource;
						break;
					}
				}
			}

			elapsedTime /= 4;
			const oldElapsedTime = (state.ElapsedTime || 0) % 64;
			if (elapsedTime !== oldElapsedTime) {
				if (oldElapsedTime > elapsedTime) { //Hit rollover value
					elapsedTime += 64;
				}
			}
			state.ElapsedTime = (state.ElapsedTime || 0) + elapsedTime - oldElapsedTime;

			if (capStateBF & 0x04) {
				const oldDistance = (state.Distance || 0) % 256;
				if (distance !== oldDistance) {
					if (oldDistance > distance) { //Hit rollover value
						distance += 256;
					}
				}
				state.Distance = (state.Distance || 0) + distance - oldDistance;
			} else {
				delete state.Distance;
			}
			if (capStateBF & 0x08) {
				state.VirtualSpeed = speed / 1000;
				delete state.RealSpeed;
			} else {
				delete state.VirtualSpeed;
				state.RealSpeed = speed / 1000;
			}
			switch ((capStateBF & 0x70) >> 4) {
				case 1: state.State = 'OFF'; break;
				case 2: state.State = 'READY'; resetState(state); break;
				case 3: state.State = 'IN_USE'; break;
				case 4: state.State = 'FINISHED'; break;
				default: delete state.State; break;
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
				state.CycleLength = cycleLen / 100;
			}
			if (incline >= -10000 && incline <= 10000) {
				state.Incline = incline / 100;
			}
			if (resistance !== 0xFF) {
				state.Resistance = resistance;
			}
			switch ((capStateBF & 0x70) >> 4) {
				case 1: state.State = 'OFF'; break;
				case 2: state.State = 'READY'; resetState(state); break;
				case 3: state.State = 'IN_USE'; break;
				case 4: state.State = 'FINISHED'; break;
				default: delete state.State; break;
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
				state.CaloricBurnRate = caloricbr / 10;
			}
			if (capStateBF & 0x01) {
				state.Calories = calories;
			}
			switch ((capStateBF & 0x70) >> 4) {
				case 1: state.State = 'OFF'; break;
				case 2: state.State = 'READY'; resetState(state); break;
				case 3: state.State = 'IN_USE'; break;
				case 4: state.State = 'FINISHED'; break;
				default: delete state.State; break;
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
				state.Cadence = cadence;
			}

			if (power !== 0xFFF) {
				state.InstantaneousPower = power;

				const oldAccPower = (state.AccumulatedPower || 0) % 65536;
				if (accPower !== oldAccPower) {
					if (oldAccPower > accPower) {
						accPower += 65536;
					}
				}
				state.AccumulatedPower = (state.AccumulatedPower || 0) + accPower - oldAccPower;

				state.AveragePower = (accPower - oldAccPower) / (eventCount - oldEventCount);
			}

			state.TrainerStatus = trainerStatus;

			switch (flagStateBF & 0x03) {
				case 0: state.TargetStatus = 'OnTarget'; break;
				case 1: state.TargetStatus = 'LowSpeed'; break;
				case 2: state.TargetStatus = 'HighSpeed'; break;
				default: delete state.TargetStatus; break;
			}

			switch ((flagStateBF & 0x70) >> 4) {
				case 1: state.State = 'OFF'; break;
				case 2: state.State = 'READY'; resetState(state); break;
				case 3: state.State = 'IN_USE'; break;
				case 4: state.State = 'FINISHED'; break;
				default: delete state.State; break;
			}
			if (flagStateBF & 0x80) {
				// lap
			}

			break;
		}
		case 0x50: {
			state.HwVersion = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			state.ManId = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			state.ModelNum = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
			break;
		}
		case 0x51: {
			const swRevSup = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const swRevMain = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const serial = data.readInt32LE(Messages.BUFFER_INDEX_MSG_DATA + 4);

			state.SwVersion = swRevMain;

			if (swRevSup !== 0xFF) {
				state.SwVersion += swRevSup / 1000;
			}

			if (serial !== 0xFFFFFFFF) {
				state.SerialNumber = serial;
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
				state.PairedDevices = [];
			}

			if (tot > 0) {
				state.PairedDevices.push({ id: devId, type: devType, paired: (chState & 0x80) ? true : false });
			}

			break;
		}
		default:
			return;
	}
	sensor.emit('fitnessData', state);
}
