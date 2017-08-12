/// <reference path="../typings/index.d.ts"/>

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class PowerState {
    constructor(deviceID: number) {
        this.DeviceID = deviceID;
    }

    DeviceID: number;

    EventCount: number;
    Slope: number;
    TimeStamp: number;
    TorqueTicksStamp: number;

    CalculatedCadence: number;
    CalculatedTorque: number;
    CalculatedPower: number;
}

class PowerScanState extends PowerState {
	Rssi: number;
	Threshold: number;
}

const updateState = function (sensor: PowerSensor | PowerScanner,
							  state: PowerState | PowerScanState, data: Buffer) {
    const oldEventCount = state.EventCount;
    const oldTimeStamp = state.TimeStamp;
    const oldTorqueTicksStamp = state.TorqueTicksStamp;

    let eventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);

    let slope = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3); // LSB
    slope |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2) << 8; // MSB

    let timeStamp = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5); // LSB
    timeStamp |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4) << 8; // MSB

    let torqueTicksStamp = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 7); // LSB
    torqueTicksStamp |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6) << 8; // MSB

    if (timeStamp !== oldTimeStamp) {
        state.EventCount = eventCount;
        if (oldEventCount > eventCount) { //Hit rollover value
            eventCount += (256);
        }

        state.TimeStamp = timeStamp;
        if (oldTimeStamp > timeStamp) { //Hit rollover value
            timeStamp += (1024 * 64);
        }

        state.Slope = slope;
        state.TorqueTicksStamp = torqueTicksStamp;
        if (oldTorqueTicksStamp > torqueTicksStamp) { //Hit rollover value
            torqueTicksStamp += (1024 * 64);
        }

        const elapsedTime = (timeStamp - oldTimeStamp) * 0.0005;
		const torqueTicks = torqueTicksStamp - oldTorqueTicksStamp;

        const cadencePeriod = elapsedTime / (eventCount - oldEventCount); // s
        const cadence =  Math.round(60 / cadencePeriod); // rpm
        state.CalculatedCadence = cadence;

        const torqueFrequency = (1 / (elapsedTime / torqueTicks)) - sensor.offset; // Hz
        const torque = torqueFrequency / (slope / 10); // Nm
        state.CalculatedTorque = torque;

        state.CalculatedPower = torque * cadence * Math.PI / 30; // Watts

        sensor.emit('powerData', state);
    }
};

/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */
export class PowerSensor extends Ant.AntPlusSensor {
    channel: number;

    static deviceType = 0x0B;
    static transmissionType = 0;
    static timeOut = 255;
    static period = 8182;

    offset = 478; // Default
    state: PowerState;

    constructor(stick) {
        super(stick);
        this.decodeDataCbk = this.decodeData.bind(this);
    }

    set_offset(offset: number) {
        this.offset = offset;
    }

    public attach(channel, deviceID): void {
        super.attach(channel, 'receive', deviceID, PowerSensor.deviceType,
            PowerSensor.transmissionType, PowerSensor.timeOut, PowerSensor.period);
        this.state = new PowerState(deviceID);
    }

    decodeData(data: Buffer) {
        const channel = data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM);
        const type = data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE);

        if (channel !== this.channel) {
            return;
        }

        switch (type) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
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

export class PowerScanner extends Ant.AntPlusScanner {
    static deviceType = 0x0B;

    states: { [id: number]: PowerState } = {};

    offset = 478; // Default

    constructor(stick) {
        super(stick);
        this.decodeDataCbk = this.decodeData.bind(this);
    }

    set_offset(offset: number) {
        this.offset = offset;
    }

    public scan() {
        super.scan('receive');
    }

    decodeData(data: Buffer) {
        if (data.length <= Messages.BUFFER_INDEX_EXT_MSG_BEGIN
            || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
            console.log('wrong message format');
            return;
        }

        const deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
        const deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

        if (deviceType !== PowerScanner.deviceType) {
            return;
        }

        if (!this.states[deviceId]) {
            this.states[deviceId] = new PowerState(deviceId);
        }

		if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
			if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
				this.states[deviceId].Rssi = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6);
				this.states[deviceId].Threshold = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7);
			}
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
				updateState(this, this.states[deviceId], data);
				break;
			default:
				break;
		}
    }
}
