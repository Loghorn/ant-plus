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
}

class BicyclePowerScanState extends BicyclePowerState {
    Rssi: number;
}

const updateState = function (sensor: ByciclePowerSensor | ByciclePowerScanner,
                              state: BicyclePowerState | BicyclePowerScanState, data: Buffer) {
    let torqueWhole = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 4);
    let torqueLeft = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 5);
    let torqueRight = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);

    let forceWhole = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 12);
    let forceLeft = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 13);
    let forceRight = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 14);

    state.TorqueWhole = torqueWhole;
    state.TorqueLeft = torqueLeft;
    state.TorqueRight = torqueRight;

    state.ForceWhole = forceWhole;
    state.ForceLeft = forceLeft;
    state.ForceRight = forceRight;

    sensor.emit('powerData', state);
};

/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#523_tab
 * Spec sheet: https://www.thisisant.com/resources/bicycle-power/
 */
export class ByciclePowerSensor extends Ant.AntPlusSensor {
    channel: number;
    static deviceType = 0x0B;
    state: BicyclePowerState;

    constructor(stick) {
        super(stick);
        this.decodeDataCbk = this.decodeData.bind(this);
    }

    public attach(channel, deviceID): void {
        super.attach(channel, 'receive', deviceID, ByciclePowerSensor.deviceType, 0, 255, 8086);
        this.state = new BicyclePowerState(deviceID);
    }

    decodeData(data: Buffer) {
        let channel = data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM);
        let type = data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE);

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

export class ByciclePowerScanner extends Ant.AntPlusScanner {
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

        let deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
        let deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

        if (deviceType !== ByciclePowerSensor.deviceType) {
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
