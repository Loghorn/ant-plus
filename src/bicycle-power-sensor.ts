/// <reference path="../typings/index.d.ts"/>

import Ant = require('./ant');

const Messages = Ant.Messages;
const Constants = Ant.Constants;

class BicyclePowerState {
    constructor(deviceID: number) {
        this.DeviceID = deviceID;
    }

    DeviceID: number;

    TorqueWhole: number;
    TorqueLeft: number;
    TorqueRight: number;

    ForceWhole: number;
    ForceLeft: number;
    ForceRight: number;

    Temperature: number;
    Voltage: number;
}

class BicyclePowerScanState extends BicyclePowerState {
    Rssi: number;
}

const updateState = function (sensor: BicyclePowerSensor | BicyclePowerScanner,
                              state: BicyclePowerState | BicyclePowerScanState, data: Buffer) {
    const torqueWhole = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
    const torqueLeft = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
    const torqueRight = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);

    const forceWhole = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 12);
    const forceLeft = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 13);
    const forceRight = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 14);

    const temperature = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 25);
    const voltage = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 26);

    state.TorqueWhole = torqueWhole;
    state.TorqueLeft = torqueLeft;
    state.TorqueRight = torqueRight;

    state.ForceWhole = forceWhole;
    state.ForceLeft = forceLeft;
    state.ForceRight = forceRight;

    state.Temperature = temperature;
    state.Voltage = voltage;

    sensor.emit('powerData', state);
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

    state: BicyclePowerState;

    constructor(stick) {
        super(stick);
        this.decodeDataCbk = this.decodeData.bind(this);
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

    constructor(stick) {
        super(stick);
        this.decodeDataCbk = this.decodeData.bind(this);
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
