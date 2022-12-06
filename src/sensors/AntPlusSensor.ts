import { Constants } from '../Constants';
import { GarminStick2 } from '../GarminStick2';
import { GarminStick3 } from '../GarminStick3';
import { Messages } from '../Messages';
import { AntPlusBaseSensor } from './AntPlusBaseSensor';
import { AttachProps } from './BaseSensor';

export abstract class AntPlusSensor extends AntPlusBaseSensor {
  constructor(stick: GarminStick2 | GarminStick3) {
    super(stick);
    this.decodeDataCbk = this.decodeData.bind(this);
  }

  protected scan(): Promise<void> {
    throw 'scanning unsupported';
  }

  protected attach(props: AttachProps) {
    return super.attach(props);
  }

  private decodeData(data: DataView) {
    switch (data.getUint8(Messages.BUFFER_INDEX_MSG_TYPE)) {
      case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
      case Constants.MESSAGE_CHANNEL_ACKNOWLEDGED_DATA:
      case Constants.MESSAGE_CHANNEL_BURST_DATA:
        if (this.channel !== undefined && this.deviceID === 0) {
          this.write(
            Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID)
          );
        }
        if (this.deviceID !== undefined) {
          this.updateState(this.deviceID, data);
        }
        break;
      case Constants.MESSAGE_CHANNEL_ID:
        this.deviceID = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA, true);
        this.transmissionType = data.getUint8(
          Messages.BUFFER_INDEX_MSG_DATA + 3
        );
        break;
      default:
        break;
    }
  }
}
