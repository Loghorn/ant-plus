import { Constants } from "../constants.js";
import type { USBDriver } from "../driver.js";
import { ChannelStateError } from "../errors.js";
import { TypedEventEmitter } from "../lib/TypedEventEmitter.js";
import type { AntMessage } from "../messages.js";
import * as messages from "../messages.js";

export interface SensorState {
  readonly deviceId: number;
}

export interface ScanState extends SensorState {
  readonly rssi?: number;
  readonly threshold?: number;
}

export type BatteryStatusValue =
  | "New"
  | "Good"
  | "Ok"
  | "Low"
  | "Critical"
  | "Invalid";

export interface ChannelEventData {
  message: number;
  code: number;
}

export interface AttachOptions {
  channel: number;
  /** Use 0 to pair with the first matching device found. */
  deviceId: number;
  transmissionType?: number;
  timeout?: number;
}

export type SensorEvents<TState> = {
  data: [Readonly<TState>];
  attached: [];
  detached: [];
  eventData: [ChannelEventData];
};

const ANT_PLUS_FREQUENCY = 57;

type StatusHandler = (status: ChannelEventData) => Promise<boolean>;

type QueuedMessage = {
  msg: AntMessage;
  resolve: (delivered: boolean) => void;
};

/**
 * Shared ANT channel plumbing: message queue, channel status state
 * machine and event dispatch. Not exported — use {@link AntPlusSensor}
 * or {@link AntPlusScanner}.
 */
abstract class AntChannel<TState extends SensorState> extends TypedEventEmitter<
  SensorEvents<TState>
> {
  channel: number | undefined;
  deviceId: number | undefined;
  transmissionType: number | undefined;

  #listeningChannel: number | undefined;
  #statusHandler: StatusHandler | undefined;
  #msgQueue: QueuedMessage[] = [];

  protected abstract readonly deviceType: number;

  constructor(protected readonly driver: USBDriver) {
    super();
    driver.on("read", (data) => {
      void this.#handleEventMessages(data);
    });
  }

  /**
   * Closes the channel. The channel is unassigned and "detached" is
   * emitted asynchronously once the stick confirms the close.
   */
  async detach(): Promise<void> {
    if (this.channel === undefined) {
      return;
    }
    const channel = this.channel;
    this.channel = undefined;
    this.driver.detach(this);
    await this.write(messages.closeChannel(channel));
  }

  protected beginChannel(
    channel: number,
    deviceId: number,
    transmissionType: number,
    handler: StatusHandler,
  ): void {
    this.channel = channel;
    this.#listeningChannel = channel;
    this.deviceId = deviceId;
    this.transmissionType = transmissionType;
    this.#statusHandler = handler;
  }

  protected async write(data: AntMessage): Promise<void> {
    await this.driver.write(data);
  }

  /**
   * Queues an acknowledged message and resolves with the delivery
   * result reported by the stick.
   */
  protected send(data: AntMessage): Promise<boolean> {
    return new Promise((resolve) => {
      this.#msgQueue.push({ msg: data, resolve });
      if (this.#msgQueue.length === 1) {
        void this.write(data);
      }
    });
  }

  #completeTransfer(delivered: boolean): void {
    const current = this.#msgQueue.shift();
    current?.resolve(delivered);
    const next = this.#msgQueue[0];
    if (next) {
      void this.write(next.msg);
    }
  }

  /** Handles status messages shared by the attach and scan flows. */
  protected async handleCommonStatus(
    status: ChannelEventData,
    channel: number,
  ): Promise<boolean> {
    switch (status.message) {
      case Constants.MESSAGE_RF:
        switch (status.code) {
          case Constants.EVENT_CHANNEL_CLOSED:
          case Constants.EVENT_RX_FAIL_GO_TO_SEARCH:
            await this.write(messages.unassignChannel(channel));
            return true;
          case Constants.EVENT_TRANSFER_TX_COMPLETED:
          case Constants.EVENT_TRANSFER_TX_FAILED:
          case Constants.EVENT_RX_FAIL:
          case Constants.INVALID_SCAN_TX_CHANNEL:
            this.#completeTransfer(
              status.code === Constants.EVENT_TRANSFER_TX_COMPLETED,
            );
            return true;
          default:
            return false;
        }
      case Constants.MESSAGE_CHANNEL_CLOSE:
        return true;
      case Constants.MESSAGE_CHANNEL_UNASSIGN:
        this.#statusHandler = undefined;
        this.#listeningChannel = undefined;
        this.channel = undefined;
        this.driver.detach(this);
        queueMicrotask(() => this.emit("detached"));
        return true;
      case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
        return status.code === Constants.TRANSFER_IN_PROGRESS;
      default:
        return false;
    }
  }

  protected abstract decodeData(data: DataView): void;

  async #handleEventMessages(data: DataView): Promise<void> {
    const messageId = data.getUint8(messages.BUFFER_INDEX_MSG_TYPE);
    const channel = data.getUint8(messages.BUFFER_INDEX_CHANNEL_NUM);
    if (channel !== this.#listeningChannel) {
      return;
    }
    if (messageId === Constants.MESSAGE_CHANNEL_EVENT) {
      const status: ChannelEventData = {
        message: data.getUint8(messages.BUFFER_INDEX_MSG_DATA),
        code: data.getUint8(messages.BUFFER_INDEX_MSG_DATA + 1),
      };
      const handled =
        this.#statusHandler && (await this.#statusHandler(status));
      if (!handled) {
        this.emit("eventData", status);
      }
    } else {
      this.decodeData(data);
    }
  }
}

/**
 * A sensor bound to a single ANT+ device on a dedicated channel.
 * Emits a typed "data" event with an immutable state snapshot on
 * every decoded broadcast.
 */
export abstract class AntPlusSensor<
  TState extends SensorState,
> extends AntChannel<TState> {
  #state: TState | undefined;

  protected abstract readonly period: number;
  protected abstract createState(deviceId: number): TState;
  protected abstract decodeState(
    state: Readonly<TState>,
    data: DataView,
  ): TState | undefined;

  /** The latest decoded state, if any broadcast has been received. */
  get state(): Readonly<TState> | undefined {
    return this.#state;
  }

  /** Assigns a channel and resolves once the channel is open. */
  async attach(options: AttachOptions): Promise<void> {
    const { channel, deviceId } = options;
    const transmissionType = options.transmissionType ?? 0;
    const timeout = options.timeout ?? Constants.TIMEOUT_NEVER;

    if (this.channel !== undefined) {
      throw new ChannelStateError("already attached");
    }
    if (!this.driver.attach(this, false)) {
      throw new ChannelStateError("cannot attach");
    }

    this.#state = this.createState(deviceId);
    this.beginChannel(channel, deviceId, transmissionType, async (status) => {
      if (await this.handleCommonStatus(status, channel)) {
        return true;
      }
      switch (status.message) {
        case Constants.MESSAGE_CHANNEL_ASSIGN:
          await this.write(
            messages.setDevice(
              channel,
              deviceId,
              this.deviceType,
              transmissionType,
            ),
          );
          return true;
        case Constants.MESSAGE_CHANNEL_ID:
          await this.write(messages.searchChannel(channel, timeout));
          return true;
        case Constants.MESSAGE_CHANNEL_SEARCH_TIMEOUT:
          await this.write(messages.setFrequency(channel, ANT_PLUS_FREQUENCY));
          return true;
        case Constants.MESSAGE_CHANNEL_FREQUENCY:
          await this.write(messages.setPeriod(channel, this.period));
          return true;
        case Constants.MESSAGE_CHANNEL_PERIOD:
          await this.write(messages.libConfig(channel, 0xe0));
          return true;
        case Constants.MESSAGE_LIB_CONFIG:
          await this.write(messages.openChannel(channel));
          return true;
        case Constants.MESSAGE_CHANNEL_OPEN:
          queueMicrotask(() => this.emit("attached"));
          return true;
        default:
          return false;
      }
    });

    const attached = new Promise<void>((resolve) => {
      this.once("attached", resolve);
    });
    await this.write(messages.assignChannel(channel, "receive"));
    await attached;
  }

  protected decodeData(data: DataView): void {
    switch (data.getUint8(messages.BUFFER_INDEX_MSG_TYPE)) {
      case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
      case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
      case Constants.MESSAGE_CHANNEL_BURST_DATA: {
        if (this.channel !== undefined && this.deviceId === 0) {
          void this.write(
            messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID),
          );
        }
        if (this.deviceId === undefined || this.#state === undefined) {
          return;
        }
        const next = this.decodeState(this.#state, data);
        if (next !== undefined) {
          this.#state = { ...next, deviceId: this.deviceId } as TState;
          this.emit("data", this.#state);
        }
        break;
      }
      case Constants.MESSAGE_CHANNEL_ID:
        this.deviceId = data.getUint16(messages.BUFFER_INDEX_MSG_DATA, true);
        this.transmissionType = data.getUint8(
          messages.BUFFER_INDEX_MSG_DATA + 3,
        );
        break;
      default:
        break;
    }
  }

  protected async sendAcknowledgedData(
    payload: readonly number[],
  ): Promise<boolean> {
    if (this.channel === undefined) {
      throw new ChannelStateError("not attached");
    }
    return this.send(messages.acknowledgedData(this.channel, payload));
  }
}

/**
 * Scans for all devices of one profile using the stick's background
 * scanning channel. Emits a typed "data" event with the per-device
 * state on every decoded broadcast.
 */
export abstract class AntPlusScanner<
  TState extends ScanState,
> extends AntChannel<TState> {
  #states = new Map<number, TState>();

  protected abstract createState(deviceId: number): TState;
  protected abstract decodeState(
    state: Readonly<TState>,
    data: DataView,
  ): TState | undefined;

  /** The latest decoded state per device id. */
  get states(): ReadonlyMap<number, Readonly<TState>> {
    return this.#states;
  }

  /** Opens the scanning channel and resolves once scanning starts. */
  async scan(): Promise<void> {
    if (this.channel !== undefined) {
      throw new ChannelStateError("already attached");
    }
    if (!this.driver.canScan) {
      throw new ChannelStateError("stick cannot scan");
    }

    const channel = 0;
    const handler: StatusHandler = async (status) => {
      if (await this.handleCommonStatus(status, channel)) {
        return true;
      }
      switch (status.message) {
        case Constants.MESSAGE_CHANNEL_ASSIGN:
          await this.write(messages.setDevice(channel, 0, 0, 0));
          return true;
        case Constants.MESSAGE_CHANNEL_ID:
          await this.write(messages.setFrequency(channel, ANT_PLUS_FREQUENCY));
          return true;
        case Constants.MESSAGE_CHANNEL_FREQUENCY:
          await this.write(messages.setRxExt());
          return true;
        case Constants.MESSAGE_ENABLE_RX_EXT:
          await this.write(messages.libConfig(channel, 0xe0));
          return true;
        case Constants.MESSAGE_LIB_CONFIG:
          await this.write(messages.openRxScan());
          return true;
        case Constants.MESSAGE_CHANNEL_OPEN_RX_SCAN:
          queueMicrotask(() => this.emit("attached"));
          return true;
        default:
          return false;
      }
    };

    const attached = new Promise<void>((resolve) => {
      this.once("attached", resolve);
    });
    if (this.driver.isScanning()) {
      this.beginChannel(channel, 0, 0, handler);
      queueMicrotask(() => this.emit("attached"));
    } else if (this.driver.attach(this, true)) {
      this.beginChannel(channel, 0, 0, handler);
      await this.write(messages.assignChannel(channel, "receive"));
    } else {
      throw new ChannelStateError("cannot attach");
    }
    await attached;
  }

  protected decodeData(data: DataView): void {
    if (
      data.byteLength <= messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3 ||
      !(data.getUint8(messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)
    ) {
      console.warn("wrong message format", data.buffer);
      return;
    }

    const deviceId = data.getUint16(
      messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1,
      true,
    );
    const deviceType = data.getUint8(messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);
    if (deviceType !== this.deviceType) {
      return;
    }

    let state = this.#states.get(deviceId);
    if (state === undefined) {
      state = this.createState(deviceId);
      this.#states.set(deviceId, state);
    }

    if (
      data.getUint8(messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40 &&
      data.getUint8(messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20
    ) {
      state = {
        ...state,
        rssi: data.getInt8(messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6),
        threshold: data.getInt8(messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7),
      } as TState;
      this.#states.set(deviceId, state);
    }

    switch (data.getUint8(messages.BUFFER_INDEX_MSG_TYPE)) {
      case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
      case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
      case Constants.MESSAGE_CHANNEL_BURST_DATA: {
        const next = this.decodeState(state, data);
        if (next !== undefined) {
          const merged = { ...next, deviceId } as TState;
          this.#states.set(deviceId, merged);
          this.emit("data", merged);
        }
        break;
      }
      default:
        break;
    }
  }
}
