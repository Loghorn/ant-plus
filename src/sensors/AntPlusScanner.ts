import { Temporal } from '@js-temporal/polyfill';
import { Constants } from '../Constants';
import { GarminStick2 } from '../GarminStick2';
import { GarminStick3 } from '../GarminStick3';
import { Messages } from '../Messages';
import { AntPlusBaseSensor } from './AntPlusBaseSensor';

export abstract class AntPlusScanner extends AntPlusBaseSensor {
  protected abstract deviceType(): number;

  protected abstract createStateIfNew(deviceId: number): void;

  protected abstract updateRssiAndThreshold(
    deviceId: number,
    rssi: number,
    threshold: number
  ): void;

  constructor(stick: GarminStick2 | GarminStick3) {
    super(stick);
    this.decodeDataCbk = this.decodeData.bind(this);
  }

  public scan() {
    return super.scan('receive');
  }

  protected attach(): Promise<void> {
    throw new Error('attach unsupported');
  }

  protected send(): Promise<void> {
    throw new Error('send unsupported');
  }

  private decodeData(data: DataView) {
    if (
      data.byteLength <= Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3 ||
      !(data.getUint8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)
    ) {
      console.warn('wrong message format', data.buffer);
      return;
    }

    const deviceId = data.getUint16(
      Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1,
      true
    );
    const deviceType = data.getUint8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

    if (deviceType !== this.deviceType()) {
      return;
    }

    this.createStateIfNew(deviceId);

    if (data.getUint8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
      if (data.getUint8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
        this.updateRssiAndThreshold(
          deviceId,
          data.getInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6),
          data.getInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7)
        );
      }
    }

    switch (data.getUint8(Messages.BUFFER_INDEX_MSG_TYPE)) {
      case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
      case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
      case Constants.MESSAGE_CHANNEL_BURST_DATA:
        this.updateState(deviceId, data, Temporal.Now.zonedDateTimeISO());
        break;
      default:
        break;
    }
  }
}
