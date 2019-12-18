/*
 * Copyright (c) 2019 Tom Cosgrove
 * Copyright (c) 2015 Alessandro Vergani
 *
 * This file is licensed under the MIT License (MIT):
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#524_tab
 * Spec sheet: https://www.thisisant.com/resources/environment/
 */

import { AntPlusSensor, AntPlusScanner, Messages } from './ant';

class EnvironmentSensorState {
	constructor(deviceId: number) {
		this.DeviceID = deviceId;
	}

	DeviceID: number;
	EventCount: number;
	Temperature: number;
}

class EnvironmentScanState extends EnvironmentSensorState {
	Rssi: number;
	Threshold: number;
}

export class EnvironmentSensor extends AntPlusSensor {
	static deviceType = 25;

	public attach(channel, deviceID) {
		super.attach(channel, 'receive', deviceID, EnvironmentSensor.deviceType, 0, 255, 8192);
		this.state = new EnvironmentSensorState(deviceID);
	}

	private state: EnvironmentSensorState;

	protected updateState(deviceId, data) {
		this.state.DeviceID = deviceId;
		updateState(this, this.state, data);
	}
}

export class EnvironmentScanner extends AntPlusScanner {
	protected deviceType() {
		return EnvironmentSensor.deviceType;
	}

	private states: { [id: number]: EnvironmentScanState } = {};

	protected createStateIfNew(deviceId) {
		if (!this.states[deviceId]) {
			this.states[deviceId] = new EnvironmentScanState(deviceId);
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
	sensor: EnvironmentSensor | EnvironmentScanner,
	state: EnvironmentSensorState | EnvironmentScanState,
	data: Buffer) {

	const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	if (page === 1) {
		state.EventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
		state.Temperature = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6) / 100;
	}
	sensor.emit('envdata', state);
	sensor.emit('envData', state);
}
