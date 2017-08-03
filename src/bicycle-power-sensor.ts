/// <reference path="../typings/index.d.ts"/>

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class BicyclePowerState {
    constructor(deviceID: number) {
        this.DeviceID = deviceID;
    }

    DeviceID: number;

    EventCount: number;
    Slope: number;
    Time: number;
    TorqueTicksStamp: number;

    CalculatedCadence: number;
    CalculatedTorque: number;
    CalculatedPower: number;
}

class BicyclePowerScanState extends BicyclePowerState {
    Rssi: number;
}

const updateState = function (sensor: BicyclePowerSensor | BicyclePowerScanner,
                              state: BicyclePowerState | BicyclePowerScanState, data: Buffer) {
    const oldEventCount = state.EventCount;
    const oldTime = state.Time;
    const oldTorqueTicks = state.TorqueTicksStamp;

    let eventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA - 3);

    let slope = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA - 2);
    slope |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA - 1) << 8;

    let timeStamp = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
    timeStamp |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1) << 8;

    let torqueTicksStamp = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
    torqueTicksStamp |= data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3) << 8;

    if (oldTime !== timeStamp) {
        state.EventCount = eventCount;
        if (oldEventCount > eventCount) { //Hit rollover value
            eventCount += (256);
        }

        state.Time = timeStamp;
        if (oldTime > timeStamp) { //Hit rollover value
            timeStamp += (1024 * 64);
        }

        state.Slope = slope;
        state.TorqueTicksStamp = torqueTicksStamp;
        if (oldTorqueTicks > torqueTicksStamp) { //Hit rollover value
            torqueTicksStamp += (1024 * 64);
        }

        const elapsedTime = (timeStamp - oldTime) * 0.0005;

        const cadencePeriod = elapsedTime / (eventCount - oldEventCount); // s
        const cadence =  Math.round(60.0 / cadencePeriod); // rpm
        state.CalculatedCadence = cadence;

        const torqueTicks = torqueTicksStamp - oldTorqueTicks;
        const torqueFrequency = 1.0 / (elapsedTime / torqueTicks) - sensor.offset; // Hz
        const torque = torqueFrequency / (slope / 10.0); // Nm
        state.CalculatedTorque = torque;

        const pi = 3.1415926535;
        state.CalculatedPower = torque * cadence * pi / 30.0; // Watts

        sensor.emit('powerData', state);
    }
};

/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */
export class BicyclePowerSensor extends Ant.AntPlusSensor {
    channel: number;

    static deviceType = 0x0B;
    static transmissionType = 0;
    static timeOut = 255;
    static period = 8182;

    offset = 418; // Default

    state: BicyclePowerState;

    constructor(stick) {
        super(stick);
        this.decodeDataCbk = this.decodeData.bind(this);
    }

    set_offset(offset: number) {
        this.offset = offset;
    }

    public attach(channel, deviceID): void {
        super.attach(channel, 'receive', deviceID, BicyclePowerSensor.deviceType,
            BicyclePowerSensor.transmissionType, BicyclePowerSensor.timeOut, BicyclePowerSensor.period;
        this.state = new BicyclePowerState(deviceID);
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

export class BicyclePowerScanner extends Ant.AntPlusScanner {
    static deviceType = 0x0B;

    states: { [id: number]: BicyclePowerState } = {};

    offset = 418; // Default

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

        if (deviceType !== BicyclePowerScanner.deviceType) {
            return;
        }

        if (!this.states[deviceId]) {
            this.states[deviceId] = new BicyclePowerState(deviceId);
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
