import { Constants } from './Constants';

export class Messages {
  static BUFFER_INDEX_MSG_LEN = 1;

  static BUFFER_INDEX_MSG_TYPE = 2;

  static BUFFER_INDEX_CHANNEL_NUM = 3;

  static BUFFER_INDEX_MSG_DATA = 4;

  static BUFFER_INDEX_EXT_MSG_BEGIN = 12;

  static resetSystem(): DataView {
    const payload: number[] = [];
    payload.push(0x00);
    return this.buildMessage(payload, Constants.MESSAGE_SYSTEM_RESET);
  }

  static requestMessage(channel: number, messageID: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    payload.push(messageID);
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_REQUEST);
  }

  static setNetworkKey(): DataView {
    const payload: number[] = [];
    payload.push(Constants.DEFAULT_NETWORK_NUMBER);
    payload.push(0xb9);
    payload.push(0xa5);
    payload.push(0x21);
    payload.push(0xfb);
    payload.push(0xbd);
    payload.push(0x72);
    payload.push(0xc3);
    payload.push(0x45);
    return this.buildMessage(payload, Constants.MESSAGE_NETWORK_KEY);
  }

  static assignChannel(channel: number, type = 'receive'): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    if (type === 'receive') {
      payload.push(Constants.CHANNEL_TYPE_TWOWAY_RECEIVE);
    } else if (type === 'receive_only') {
      payload.push(Constants.CHANNEL_TYPE_ONEWAY_RECEIVE);
    } else if (type === 'receive_shared') {
      payload.push(Constants.CHANNEL_TYPE_SHARED_RECEIVE);
    } else if (type === 'transmit') {
      payload.push(Constants.CHANNEL_TYPE_TWOWAY_TRANSMIT);
    } else if (type === 'transmit_only') {
      payload.push(Constants.CHANNEL_TYPE_ONEWAY_TRANSMIT);
    } else if (type === 'transmit_shared') {
      payload.push(Constants.CHANNEL_TYPE_SHARED_TRANSMIT);
    } else {
      throw 'type not allowed';
    }
    payload.push(Constants.DEFAULT_NETWORK_NUMBER);
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_ASSIGN);
  }

  static setDevice(
    channel: number,
    deviceID: number,
    deviceType: number,
    transmissionType: number
  ): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    payload = payload.concat(this.intToLEHexArray(deviceID, 2));
    payload = payload.concat(this.intToLEHexArray(deviceType));
    payload = payload.concat(this.intToLEHexArray(transmissionType));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_ID);
  }

  static searchChannel(channel: number, timeout: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    payload = payload.concat(this.intToLEHexArray(timeout));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_SEARCH_TIMEOUT);
  }

  static setPeriod(channel: number, period: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    payload = payload.concat(this.intToLEHexArray(period));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_PERIOD);
  }

  static setFrequency(channel: number, frequency: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    payload = payload.concat(this.intToLEHexArray(frequency));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_FREQUENCY);
  }

  static setRxExt(): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(0));
    payload = payload.concat(this.intToLEHexArray(1));
    return this.buildMessage(payload, Constants.MESSAGE_ENABLE_RX_EXT);
  }

  static libConfig(channel: number, how: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    payload = payload.concat(this.intToLEHexArray(how));
    return this.buildMessage(payload, Constants.MESSAGE_LIB_CONFIG);
  }

  static openRxScan(): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(0));
    payload = payload.concat(this.intToLEHexArray(1));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_OPEN_RX_SCAN);
  }

  static openChannel(channel: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_OPEN);
  }

  static closeChannel(channel: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_CLOSE);
  }

  static unassignChannel(channel: number): DataView {
    let payload: number[] = [];
    payload = payload.concat(this.intToLEHexArray(channel));
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_UNASSIGN);
  }

  static acknowledgedData(channel: number, payload: number[]): DataView {
    payload = this.intToLEHexArray(channel).concat(payload);
    return this.buildMessage(
      payload,
      Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA
    );
  }

  static broadcastData(channel: number, payload: number[]): DataView {
    payload = this.intToLEHexArray(channel).concat(payload);
    return this.buildMessage(payload, Constants.MESSAGE_CHANNEL_BROADCAST_DATA);
  }

  static buildMessage(payload: number[] = [], msgID = 0x00): DataView {
    const m: number[] = [];
    m.push(Constants.MESSAGE_TX_SYNC);
    m.push(payload.length);
    m.push(msgID);
    payload.forEach((byte) => {
      m.push(byte);
    });
    m.push(this.getChecksum(m));
    return new DataView(new Uint8Array(m).buffer);
  }

  static intToLEHexArray(int: number, numBytes = 1): number[] {
    numBytes = numBytes || 1;
    const ret: number[] = [];
    const hexStr = this.decimalToHex(int, numBytes * 2);
    const b = new DataView(
      new Uint8Array(
        hexStr.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      ).buffer
    );
    let i = b.byteLength - 1;
    while (i >= 0) {
      ret.push(b.getUint8(i));
      i--;
    }
    return ret;
  }

  static decimalToHex(d: number, numDigits: number): string {
    let hex = Number(d).toString(16);
    numDigits = numDigits || 2;
    while (hex.length < numDigits) {
      hex = `0${hex}`;
    }
    return hex;
  }

  static getChecksum(message: any[]): number {
    let checksum = 0;
    message.forEach((byte) => {
      checksum = (checksum ^ byte) % 0xff;
    });
    return checksum;
  }
}
