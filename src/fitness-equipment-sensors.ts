/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import { Messages, SendCallback, AntPlusSensor, AntPlusScanner } from './ant';

class FitnessEquipmentSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	_EventCount0x19?: number;
	_EventCount0x1A?: number;

	DeviceID: number;
	Temperature?: number;
	ZeroOffset?: number;
	SpinDownTime?: number;

	EquipmentType?: 'Treadmill' | 'Elliptical' | 'Reserved' | 'Rower' | 'Climber' | 'NordicSkier' | 'Trainer/StationaryBike' | 'General';
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

	AscendedDistance?: number;
	DescendedDistance?: number;

	Strides?: number;
	Strokes?: number;

	Cadence?: number;
	AccumulatedPower?: number;
	InstantaneousPower?: number;
	AveragePower?: number;
	TrainerStatus?: number;
	TargetStatus?: 'OnTarget' | 'LowSpeed' | 'HighSpeed';

	WheelTicks?: number;
	WheelPeriod?: number;
	Torque?: number;

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

export class FitnessEquipmentSensor extends AntPlusSensor {
	static deviceType = 0x11;

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, FitnessEquipmentSensor.deviceType, 0, 255, 8192);
		this.state = new FitnessEquipmentSensorState(deviceID);
	}

	private state: FitnessEquipmentSensorState;

	protected updateState(deviceId, data) {
		this.state.DeviceID = deviceId;
		updateState(this, this.state, data);
	}

	private _setUserConfiguration(userWeight?: number, bikeWeight?: number, wheelDiameter?: number, gearRatio?: number,
		cbk?: SendCallback) {
		const m = userWeight === undefined ? 0xFFFF : Math.max(0, Math.min(65534, Math.round(userWeight * 100)));
		const df = wheelDiameter === undefined ? 0xFF : Math.round(wheelDiameter * 10) % 10;
		const mb = bikeWeight === undefined ? 0xFFF : Math.max(0, Math.min(1000, Math.round(bikeWeight * 20)));
		const d = wheelDiameter === undefined ? 0xFF : Math.max(0, Math.min(254, Math.round(wheelDiameter)));
		const gr = gearRatio === undefined ? 0x00 : Math.max(1, Math.min(255, Math.round(gearRatio / .03)));
		const payload = [0x37, m & 0xFF, (m >> 8) & 0xFF, 0xFF, (df & 0xF) | ((mb & 0xF) << 4), (mb >> 4) & 0xF, d & 0xFF, gr & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}

	public setUserConfiguration(cbk: SendCallback);
	public setUserConfiguration(userWeight: number, cbk?: SendCallback);
	public setUserConfiguration(userWeight: number, bikeWeight: number, cbk?: SendCallback);
	public setUserConfiguration(userWeight: number, bikeWeight: number, wheelDiameter: number, cbk?: SendCallback);
	public setUserConfiguration(userWeight: number, bikeWeight: number, wheelDiameter: number, gearRatio: number, cbk?: SendCallback);
	public setUserConfiguration(userWeight?: number | SendCallback, bikeWeight?: number | SendCallback, wheelDiameter?: number | SendCallback,
		gearRatio?: number | SendCallback, cbk?: SendCallback) {
		if (typeof (userWeight) === 'function') {
			return this._setUserConfiguration(undefined, undefined, undefined, undefined, userWeight);
		} else if (typeof (bikeWeight) === 'function') {
			return this._setUserConfiguration(userWeight, undefined, undefined, undefined, bikeWeight);
		} else if (typeof (wheelDiameter) === 'function') {
			return this._setUserConfiguration(userWeight, bikeWeight, undefined, undefined, wheelDiameter);
		} else if (typeof (gearRatio) === 'function') {
			return this._setUserConfiguration(userWeight, bikeWeight, wheelDiameter, undefined, gearRatio);
		} else {
			return this._setUserConfiguration(userWeight, bikeWeight, wheelDiameter, gearRatio, cbk);
		}
	}

	public setBasicResistance(resistance: number, cbk?: SendCallback) {
		const res = Math.max(0, Math.min(200, Math.round(resistance * 2)));
		const payload = [0x30, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, res & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}

	public setTargetPower(power: number, cbk?: SendCallback) {
		const p = Math.max(0, Math.min(4000, Math.round(power * 4)));
		const payload = [0x31, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, p & 0xFF, (p >> 8) & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}

	private _setWindResistance(windCoeff?: number, windSpeed?: number, draftFactor?: number, cbk?: SendCallback) {
		const wc = windCoeff === undefined ? 0xFF : Math.max(0, Math.min(186, Math.round(windCoeff * 100)));
		const ws = windSpeed === undefined ? 0xFF : Math.max(0, Math.min(254, Math.round(windSpeed + 127)));
		const df = draftFactor === undefined ? 0xFF : Math.max(0, Math.min(100, Math.round(draftFactor * 100)));
		const payload = [0x32, 0xFF, 0xFF, 0xFF, 0xFF, wc & 0xFF, ws & 0xFF, df & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}

	public setWindResistance(cbk: SendCallback);
	public setWindResistance(windCoeff: number, cbk?: SendCallback);
	public setWindResistance(windCoeff: number, windSpeed: number, cbk?: SendCallback);
	public setWindResistance(windCoeff: number, windSpeed: number, draftFactor: number, cbk?: SendCallback);
	public setWindResistance(windCoeff?: number | SendCallback, windSpeed?: number | SendCallback, draftFactor?: number | SendCallback,
		cbk?: SendCallback) {
		if (typeof (windCoeff) === 'function') {
			return this._setWindResistance(undefined, undefined, undefined, windCoeff);
		} else if (typeof (windSpeed) === 'function') {
			return this._setWindResistance(windCoeff, undefined, undefined, windSpeed);
		} else if (typeof (draftFactor) === 'function') {
			return this._setWindResistance(windCoeff, windSpeed, undefined, draftFactor);
		} else {
			return this._setWindResistance(windCoeff, windSpeed, draftFactor, cbk);
		}
	}

	private _setTrackResistance(slope?: number, rollingResistanceCoeff?: number, cbk?: SendCallback) {
		const s = slope === undefined ? 0xFFFF : Math.max(0, Math.min(40000, Math.round((slope + 200) * 100)));
		const rr = rollingResistanceCoeff === undefined ? 0xFF : Math.max(0, Math.min(254, Math.round(rollingResistanceCoeff * 20000)));
		const payload = [0x33, 0xFF, 0xFF, 0xFF, 0xFF, s & 0xFF, (s >> 8) & 0xFF, rr & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}

	public setTrackResistance(cbk: SendCallback);
	public setTrackResistance(slope: number, cbk?: SendCallback);
	public setTrackResistance(slope: number, rollingResistanceCoeff: number, cbk?: SendCallback);
	public setTrackResistance(slope?: number | SendCallback, rollingResistanceCoeff?: number | SendCallback, cbk?: SendCallback) {
		if (typeof (slope) === 'function') {
			return this._setTrackResistance(undefined, undefined, slope);
		} else if (typeof (rollingResistanceCoeff) === 'function') {
			return this._setTrackResistance(slope, undefined, rollingResistanceCoeff);
		} else {
			return this._setTrackResistance(slope, rollingResistanceCoeff, cbk);
		}
	}
}

export class FitnessEquipmentScanner extends AntPlusScanner {
	protected deviceType() {
		return FitnessEquipmentSensor.deviceType;
	}

	private states: { [id: number]: FitnessEquipmentScanState } = {};

	protected createStateIfNew(deviceId) {
		if (!this.states[deviceId]) {
			this.states[deviceId] = new FitnessEquipmentScanState(deviceId);
		}
	}

	protected updateRssiAndThreshold(deviceId, rssi, threshold) {
		this.states[deviceId].Rssi = rssi;
		this.states[deviceId].Threshold = threshold;
	}

	protected updateState(deviceId, data) {
		updateState(this, this.states[deviceId], data);
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
	delete state._EventCount0x1A;
	delete state.Cadence;
	delete state.AccumulatedPower;
	delete state.InstantaneousPower;
	delete state.AveragePower;
	delete state.TrainerStatus;
	delete state.TargetStatus;
	delete state.AscendedDistance;
	delete state.DescendedDistance;
	delete state.Strides;
	delete state.Strokes;
	delete state.WheelTicks;
	delete state.WheelPeriod;
	delete state.Torque;
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
				case 21: state.EquipmentType = 'Reserved'; break;
				case 22: state.EquipmentType = 'Rower'; break;
				case 23: state.EquipmentType = 'Climber'; break;
				case 24: state.EquipmentType = 'NordicSkier'; break;
				case 25: state.EquipmentType = 'Trainer/StationaryBike'; break;
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
		case 0x13: {
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
			let negDistance = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
			let posDistance = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (cadence !== 0xFF) {
				state.Cadence = cadence;
			}

			if (flagStateBF & 0x02) {
				const oldNegDistance = (state.DescendedDistance || 0) % 256;
				if (negDistance !== oldNegDistance) {
					if (oldNegDistance > negDistance) {
						negDistance += 256;
					}
				}
				state.DescendedDistance = (state.DescendedDistance || 0) + negDistance - oldNegDistance;
			}

			if (flagStateBF & 0x01) {
				const oldPosDistance = (state.AscendedDistance || 0) % 256;
				if (posDistance !== oldPosDistance) {
					if (oldPosDistance > posDistance) {
						posDistance += 256;
					}
				}
				state.AscendedDistance = (state.AscendedDistance || 0) + posDistance - oldPosDistance;
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
		case 0x14: {
			let posDistance = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			let strides = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5);
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (cadence !== 0xFF) {
				state.Cadence = cadence;
			}

			if (power !== 0xFFFF) {
				state.InstantaneousPower = power;
			}

			if (flagStateBF & 0x02) {
				const oldPosDistance = (state.AscendedDistance || 0) % 256;
				if (posDistance !== oldPosDistance) {
					if (oldPosDistance > posDistance) {
						posDistance += 256;
					}
				}
				state.AscendedDistance = (state.AscendedDistance || 0) + posDistance - oldPosDistance;
			}

			if (flagStateBF & 0x01) {
				const oldStrides = (state.Strides || 0) % 256;
				if (strides !== oldStrides) {
					if (oldStrides > strides) {
						strides += 256;
					}
				}
				state.Strides = (state.Strides || 0) + strides - oldStrides;
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
		case 0x16: {
			let strokes = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5);
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (cadence !== 0xFF) {
				state.Cadence = cadence;
			}

			if (power !== 0xFFFF) {
				state.InstantaneousPower = power;
			}

			if (flagStateBF & 0x01) {
				const oldStrokes = (state.Strokes || 0) % 256;
				if (strokes !== oldStrokes) {
					if (oldStrokes > strokes) {
						strokes += 256;
					}
				}
				state.Strokes = (state.Strokes || 0) + strokes - oldStrokes;
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
		case 0x17: {
			let strides = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5);
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (cadence !== 0xFF) {
				state.Cadence = cadence;
			}

			if (power !== 0xFFFF) {
				state.InstantaneousPower = power;
			}

			if (flagStateBF & 0x01) {
				const oldStrides = (state.Strides || 0) % 256;
				if (strides !== oldStrides) {
					if (oldStrides > strides) {
						strides += 256;
					}
				}
				state.Strides = (state.Strides || 0) + strides - oldStrides;
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
		case 0x18: {
			let strides = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
			const power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5);
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (cadence !== 0xFF) {
				state.Cadence = cadence;
			}

			if (power !== 0xFFFF) {
				state.InstantaneousPower = power;
			}

			if (flagStateBF & 0x01) {
				const oldStrides = (state.Strides || 0) % 256;
				if (strides !== oldStrides) {
					if (oldStrides > strides) {
						strides += 256;
					}
				}
				state.Strides = (state.Strides || 0) + strides - oldStrides;
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
		case 0x1A: {
			const oldEventCount = state._EventCount0x1A || 0;

			let eventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			let wheelTicks = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			let accWheelPeriod = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 3);
			let accTorque = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5);
			const flagStateBF = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7);

			if (eventCount !== oldEventCount) {
				state._EventCount0x1A = eventCount;
				if (oldEventCount > eventCount) { //Hit rollover value
					eventCount += 255;
				}
			}

			const oldWheelTicks = (state.WheelTicks || 0) % 256;
			if (wheelTicks !== oldWheelTicks) {
				if (oldWheelTicks > wheelTicks) {
					wheelTicks += 65536;
				}
			}
			state.WheelTicks = (state.WheelTicks || 0) + wheelTicks - oldWheelTicks;

			const oldWheelPeriod = (state.WheelPeriod || 0) % 256;
			if (accWheelPeriod !== oldWheelPeriod) {
				if (oldWheelPeriod > accWheelPeriod) {
					accWheelPeriod += 65536;
				}
			}
			state.WheelPeriod = (state.WheelPeriod || 0) + accWheelPeriod - oldWheelPeriod;

			const oldTorque = (state.Torque || 0) % 256;
			if (accTorque !== oldTorque) {
				if (oldTorque > accTorque) {
					accTorque += 65536;
				}
			}
			state.Torque = (state.Torque || 0) + accTorque - oldTorque;

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
