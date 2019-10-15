/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-speed-and-cadence/
 */

import { AntPlusSensor, AntPlusScanner, Messages } from './ant';

class SpeedCadenceSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	CadenceEventTime: number;
	CumulativeCadenceRevolutionCount: number;
	SpeedEventTime: number;
	CumulativeSpeedRevolutionCount: number;
	CalculatedCadence: number;
	CalculatedDistance: number;
	CalculatedSpeed: number;
}

class SpeedCadenceScanState extends SpeedCadenceSensorState {
	Rssi: number;
	Threshold: number;
}

export class SpeedCadenceSensor extends AntPlusSensor {
	static deviceType = 0x79;

	wheelCircumference: number = 2.199; // default 70cm wheel

	public setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, SpeedCadenceSensor.deviceType, 0, 255, 8086);
		this.state = new SpeedCadenceSensorState(deviceID);
	}

	private state: SpeedCadenceSensorState;

	protected updateState(deviceId, data) {
		this.state.DeviceID = deviceId;
		updateState(this, this.state, data);
	}
}

export class SpeedCadenceScanner extends AntPlusScanner {
	protected deviceType() {
		return SpeedCadenceSensor.deviceType;
	}

	wheelCircumference: number = 2.199; // default 70cm wheel

	public setWheelCircumference(wheelCircumference: number) {
		this.wheelCircumference = wheelCircumference;
	}

	private states: { [id: number]: SpeedCadenceScanState } = {};

	protected createStateIfNew(deviceId) {
		if (!this.states[deviceId]) {
			this.states[deviceId] = new SpeedCadenceScanState(deviceId);
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
	sensor: SpeedCadenceSensor | SpeedCadenceScanner,
	state: SpeedCadenceSensorState | SpeedCadenceScanState,
	data: Buffer) {

	//get old state for calculating cumulative values
	const oldCadenceTime = state.CadenceEventTime;
	const oldCadenceCount = state.CumulativeCadenceRevolutionCount;
	const oldSpeedTime = state.SpeedEventTime;
	const oldSpeedCount = state.CumulativeSpeedRevolutionCount;

	let cadenceTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
	let cadenceCount = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 2);
	let speedEventTime = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
	let speedRevolutionCount = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);

	if (cadenceTime !== oldCadenceTime) {
		state.CadenceEventTime = cadenceTime;
		state.CumulativeCadenceRevolutionCount = cadenceCount;

		if (oldCadenceTime > cadenceTime) { //Hit rollover value
			cadenceTime += (1024 * 64);
		}

		if (oldCadenceCount > cadenceCount) { //Hit rollover value
			cadenceCount += (1024 * 64);
		}

		const cadence = ((60 * (cadenceCount - oldCadenceCount) * 1024) / (cadenceTime - oldCadenceTime));
		if (!isNaN(cadence)) {
			state.CalculatedCadence = cadence;
			sensor.emit('cadenceData', state);
		}
	}

	if (speedEventTime !== oldSpeedTime) {
		state.SpeedEventTime = speedEventTime;
		state.CumulativeSpeedRevolutionCount = speedRevolutionCount;

		if (oldSpeedTime > speedEventTime) { //Hit rollover value
			speedEventTime += (1024 * 64);
		}

		if (oldSpeedCount > speedRevolutionCount) { //Hit rollover value
			speedRevolutionCount += (1024 * 64);
		}

		const distance = sensor.wheelCircumference * (speedRevolutionCount - oldSpeedCount);
		state.CalculatedDistance = distance;

		//speed in m/sec
		const speed = (distance * 1024) / (speedEventTime - oldSpeedTime);
		if (!isNaN(speed)) {
			state.CalculatedSpeed = speed;
			sensor.emit('speedData', state);
		}
	}
}
