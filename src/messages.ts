import { Constants } from "./constants.js";

/** An encoded ANT message, always backed by a plain ArrayBuffer. */
export type AntMessage = DataView<ArrayBuffer>;

export const BUFFER_INDEX_MSG_LEN = 1;
export const BUFFER_INDEX_MSG_TYPE = 2;
export const BUFFER_INDEX_CHANNEL_NUM = 3;
export const BUFFER_INDEX_MSG_DATA = 4;
export const BUFFER_INDEX_EXT_MSG_BEGIN = 12;

export type ChannelType =
  | "receive"
  | "receive_only"
  | "receive_shared"
  | "transmit"
  | "transmit_only"
  | "transmit_shared";

const CHANNEL_TYPE_CODES: Record<ChannelType, number> = {
  receive: Constants.CHANNEL_TYPE_TWOWAY_RECEIVE,
  receive_only: Constants.CHANNEL_TYPE_ONEWAY_RECEIVE,
  receive_shared: Constants.CHANNEL_TYPE_SHARED_RECEIVE,
  transmit: Constants.CHANNEL_TYPE_TWOWAY_TRANSMIT,
  transmit_only: Constants.CHANNEL_TYPE_ONEWAY_TRANSMIT,
  transmit_shared: Constants.CHANNEL_TYPE_SHARED_TRANSMIT,
};

export function getChecksum(message: readonly number[]): number {
  return message.reduce((acc, byte) => (acc ^ byte) % 0xff, 0);
}

export function buildMessage(
  payload: readonly number[],
  messageId: number,
): AntMessage {
  const message = [
    Constants.MESSAGE_TX_SYNC,
    payload.length,
    messageId,
    ...payload,
  ];
  message.push(getChecksum(message));
  return new DataView(new Uint8Array(message).buffer);
}

/** Encodes an unsigned integer as little-endian bytes of a fixed width. */
export function intToLEByteArray(value: number, numBytes = 1): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < numBytes; i++) {
    bytes.push((value >>> (8 * i)) & 0xff);
  }
  return bytes;
}

export function resetSystem(): AntMessage {
  return buildMessage([0x00], Constants.MESSAGE_SYSTEM_RESET);
}

export function requestMessage(channel: number, messageId: number): AntMessage {
  return buildMessage([channel, messageId], Constants.MESSAGE_CHANNEL_REQUEST);
}

export function setNetworkKey(): AntMessage {
  return buildMessage(
    [
      Constants.DEFAULT_NETWORK_NUMBER,
      0xb9,
      0xa5,
      0x21,
      0xfb,
      0xbd,
      0x72,
      0xc3,
      0x45,
    ],
    Constants.MESSAGE_NETWORK_KEY,
  );
}

export function assignChannel(
  channel: number,
  type: ChannelType = "receive",
): AntMessage {
  return buildMessage(
    [channel, CHANNEL_TYPE_CODES[type], Constants.DEFAULT_NETWORK_NUMBER],
    Constants.MESSAGE_CHANNEL_ASSIGN,
  );
}

export function setDevice(
  channel: number,
  deviceId: number,
  deviceType: number,
  transmissionType: number,
): AntMessage {
  return buildMessage(
    [channel, ...intToLEByteArray(deviceId, 2), deviceType, transmissionType],
    Constants.MESSAGE_CHANNEL_ID,
  );
}

export function searchChannel(channel: number, timeout: number): AntMessage {
  return buildMessage(
    [channel, timeout],
    Constants.MESSAGE_CHANNEL_SEARCH_TIMEOUT,
  );
}

export function setPeriod(channel: number, period: number): AntMessage {
  return buildMessage(
    [channel, ...intToLEByteArray(period, 2)],
    Constants.MESSAGE_CHANNEL_PERIOD,
  );
}

export function setFrequency(channel: number, frequency: number): AntMessage {
  return buildMessage(
    [channel, frequency],
    Constants.MESSAGE_CHANNEL_FREQUENCY,
  );
}

export function setRxExt(): AntMessage {
  return buildMessage([0x00, 0x01], Constants.MESSAGE_ENABLE_RX_EXT);
}

export function libConfig(channel: number, how: number): AntMessage {
  return buildMessage([channel, how], Constants.MESSAGE_LIB_CONFIG);
}

export function openRxScan(): AntMessage {
  return buildMessage([0x00, 0x01], Constants.MESSAGE_CHANNEL_OPEN_RX_SCAN);
}

export function openChannel(channel: number): AntMessage {
  return buildMessage([channel], Constants.MESSAGE_CHANNEL_OPEN);
}

export function closeChannel(channel: number): AntMessage {
  return buildMessage([channel], Constants.MESSAGE_CHANNEL_CLOSE);
}

export function unassignChannel(channel: number): AntMessage {
  return buildMessage([channel], Constants.MESSAGE_CHANNEL_UNASSIGN);
}

export function acknowledgedData(
  channel: number,
  payload: readonly number[],
): AntMessage {
  return buildMessage(
    [channel, ...payload],
    Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA,
  );
}

export function broadcastData(
  channel: number,
  payload: readonly number[],
): AntMessage {
  return buildMessage(
    [channel, ...payload],
    Constants.MESSAGE_CHANNEL_BROADCAST_DATA,
  );
}
