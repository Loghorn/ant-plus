/** Base class for all errors thrown by web-ant-plus. */
export class AntPlusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** No matching USB device was found or the device is not usable. */
export class DeviceNotFoundError extends AntPlusError {}

/** A channel operation was attempted in an invalid state (e.g. already attached). */
export class ChannelStateError extends AntPlusError {}

/** Malformed or unexpected data on the ANT+ protocol level. */
export class ProtocolError extends AntPlusError {}
