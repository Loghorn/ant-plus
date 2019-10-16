/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */

import { Messages, SendCallback, AntPlusSensor, AntPlusScanner } from './ant';

class MuscleOxygenSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	_EventCount?: number;

	DeviceID: number;

	UTCTimeRequired?: boolean;
	SupportANTFS?: boolean;
	MeasurementInterval?: 0.25 | 0.5 | 1 | 2;
	TotalHemoglobinConcentration?: number | 'AmbientLightTooHigh' | 'Invalid';
	PreviousSaturatedHemoglobinPercentage?: number | 'AmbientLightTooHigh' | 'Invalid';
	CurrentSaturatedHemoglobinPercentage?: number | 'AmbientLightTooHigh' | 'Invalid';

	HwVersion?: number;
	ManId?: number;
	ModelNum?: number;

	SwVersion?: number;
	SerialNumber?: number;

	OperatingTime?: number;
	BatteryVoltage?: number;
	BatteryStatus?: 'New' | 'Good' | 'Ok' | 'Low' | 'Critical' | 'Invalid';
}

class MuscleOxygenScanState extends MuscleOxygenSensorState {
	Rssi: number;
	Threshold: number;
}

export class MuscleOxygenSensor extends AntPlusSensor {
	static deviceType = 0x1F;

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, MuscleOxygenSensor.deviceType, 0, 255, 8192);
		this.state = new MuscleOxygenSensorState(deviceID);
	}

	private state: MuscleOxygenSensorState;

	protected updateState(deviceId, data) {
		this.state.DeviceID = deviceId;
		updateState(this, this.state, data);
	}

	private _sendTimeCmd(cmd: number, cbk?: SendCallback) {
		const now = new Date();
		const utc = Math.round((now.getTime() - Date.UTC(1989, 11, 31, 0, 0, 0, 0)) / 1000);
		const offset = -Math.round(now.getTimezoneOffset() / 15);
		const payload = [0x10, cmd & 0xFF, 0xFF, offset & 0xFF, (utc >> 0) & 0xFF, (utc >> 8) & 0xFF, (utc >> 16) & 0xFF, (utc >> 24) & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}

	public setUTCTime(cbk?: SendCallback) {
		this._sendTimeCmd(0x00, cbk);
	}

	public startSession(cbk?: SendCallback) {
		this._sendTimeCmd(0x01, cbk);
	}

	public stopSession(cbk?: SendCallback) {
		this._sendTimeCmd(0x02, cbk);
	}

	public setLap(cbk?: SendCallback) {
		this._sendTimeCmd(0x03, cbk);
	}
}

export class MuscleOxygenScanner extends AntPlusScanner {
	protected deviceType() {
		return MuscleOxygenSensor.deviceType;
	}

	private states: { [id: number]: MuscleOxygenScanState } = {};

	protected createStateIfNew(deviceId) {
		if (!this.states[deviceId]) {
			this.states[deviceId] = new MuscleOxygenScanState(deviceId);
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

function updateState(
	sensor: MuscleOxygenSensor | MuscleOxygenScanner,
	state: MuscleOxygenSensorState | MuscleOxygenScanState,
	data: Buffer) {

	const oldEventCount = state._EventCount || 0;

	const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	switch (page) {
		case 0x01: {

			let eventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			const notifications = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const capabilities = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 3);
			const total = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4) & 0xFFF;
			const previous = (data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 5) >> 4) & 0x3FF;
			const current = (data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6) >> 6) & 0x3FF;

			if (eventCount !== oldEventCount) {
				state._EventCount = eventCount;
				if (oldEventCount > eventCount) { //Hit rollover value
					eventCount += 255;
				}
			}

			state.UTCTimeRequired = (notifications & 0x01) === 0x01;

			state.SupportANTFS = (capabilities & 0x01) === 0x01;

			switch ((capabilities >> 1) & 0x7) {
				case 1: state.MeasurementInterval = 0.25; break;
				case 2: state.MeasurementInterval = 0.5; break;
				case 3: state.MeasurementInterval = 1; break;
				case 4: state.MeasurementInterval = 2; break;
				default: delete state.MeasurementInterval;
			}

			switch (total) {
				case 0xFFE: state.TotalHemoglobinConcentration = 'AmbientLightTooHigh'; break;
				case 0xFFF: state.TotalHemoglobinConcentration = 'Invalid'; break;
				default: state.TotalHemoglobinConcentration = total;
			}

			switch (previous) {
				case 0x3FE: state.PreviousSaturatedHemoglobinPercentage = 'AmbientLightTooHigh'; break;
				case 0x3FF: state.PreviousSaturatedHemoglobinPercentage = 'Invalid'; break;
				default: state.PreviousSaturatedHemoglobinPercentage = previous;
			}

			switch (current) {
				case 0x3FE: state.CurrentSaturatedHemoglobinPercentage = 'AmbientLightTooHigh'; break;
				case 0x3FF: state.CurrentSaturatedHemoglobinPercentage = 'Invalid'; break;
				default: state.CurrentSaturatedHemoglobinPercentage = current;
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
		case 0x52: {
			const batteryId = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			const operatingTime = data.readUInt32LE(Messages.BUFFER_INDEX_MSG_DATA + 3) & 0xFFFFFF;
			const batteryFrac = data.readInt32LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
			const batteryStatus = data.readInt32LE(Messages.BUFFER_INDEX_MSG_DATA + 7);

			state.OperatingTime = operatingTime * (((batteryStatus & 0x80) === 0x80) ? 2 : 16);
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
		default:
			return;
	}
	if (page !== 0x01 || state._EventCount !== oldEventCount) {
		sensor.emit('oxygenData', state);
	}
}
