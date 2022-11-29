/*
 * ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#525_tab
 * Spec sheet: https://www.thisisant.com/resources/fitness-equipment-device/
 */

import { Messages } from '../Messages';

export class FitnessEquipmentSensorState {
  constructor(deviceID: number) {
    this.DeviceID = deviceID;
  }

  _EventCount0x19?: number;

  _EventCount0x1A?: number;

  DeviceID: number;

  Temperature?: number;

  ZeroOffset?: number;

  SpinDownTime?: number;

  EquipmentType?:
    | 'Treadmill'
    | 'Elliptical'
    | 'Reserved'
    | 'Rower'
    | 'Climber'
    | 'NordicSkier'
    | 'Trainer/StationaryBike'
    | 'General';

  ElapsedTime?: number;

  Distance?: number;

  RealSpeed?: number;

  VirtualSpeed?: number;

  HeartRate?: number;

  HeartRateSource?: 'HandContact' | 'EM' | 'ANT+';

  State?: 'OFF' | 'READY' | 'IN_USE' | 'FINISHED';

  CycleLength?: number;

  Incline?: number;

  Resistance?: number;

  METs?: number;

  CaloricBurnRate?: number;

  Calories?: number;

  AscendedDistance?: number;

  DescendedDistance?: number;

  Strides?: number;

  Strokes?: number;

  Cadence?: number;

  AccumulatedPower?: number;

  InstantaneousPower?: number;

  AveragePower?: number;

  TrainerStatus?: number;

  TargetStatus?: 'OnTarget' | 'LowSpeed' | 'HighSpeed';

  WheelTicks?: number;

  WheelPeriod?: number;

  Torque?: number;

  HwVersion?: number;

  ManId?: number;

  ModelNum?: number;

  SwVersion?: number;

  SerialNumber?: number;

  PairedDevices: any[] = [];

  resetState() {
    delete this.ElapsedTime;
    delete this.Distance;
    delete this.RealSpeed;
    delete this.VirtualSpeed;
    delete this.HeartRate;
    delete this.HeartRateSource;
    delete this.CycleLength;
    delete this.Incline;
    delete this.Resistance;
    delete this.METs;
    delete this.CaloricBurnRate;
    delete this.Calories;
    delete this._EventCount0x19;
    delete this._EventCount0x1A;
    delete this.Cadence;
    delete this.AccumulatedPower;
    delete this.InstantaneousPower;
    delete this.AveragePower;
    delete this.TrainerStatus;
    delete this.TargetStatus;
    delete this.AscendedDistance;
    delete this.DescendedDistance;
    delete this.Strides;
    delete this.Strokes;
    delete this.WheelTicks;
    delete this.WheelPeriod;
    delete this.Torque;
  }

  updateState(data: DataView): FitnessEquipmentSensorState {
    const page = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA);
    switch (page) {
      case 0x01: {
        const temperature = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        if (temperature !== 0xff) {
          this.Temperature = -25 + temperature * 0.5;
        }
        const calBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        if (calBF & 0x40) {
          this.ZeroOffset = data.getUint16(
            Messages.BUFFER_INDEX_MSG_DATA + 4,
            true
          );
        }
        if (calBF & 0x80) {
          this.SpinDownTime = data.getUint16(
            Messages.BUFFER_INDEX_MSG_DATA + 6,
            true
          );
        }
        break;
      }
      case 0x10: {
        const equipmentTypeBF = data.getUint8(
          Messages.BUFFER_INDEX_MSG_DATA + 1
        );
        switch (equipmentTypeBF & 0x1f) {
          case 19:
            this.EquipmentType = 'Treadmill';
            break;
          case 20:
            this.EquipmentType = 'Elliptical';
            break;
          case 21:
            this.EquipmentType = 'Reserved';
            break;
          case 22:
            this.EquipmentType = 'Rower';
            break;
          case 23:
            this.EquipmentType = 'Climber';
            break;
          case 24:
            this.EquipmentType = 'NordicSkier';
            break;
          case 25:
            this.EquipmentType = 'Trainer/StationaryBike';
            break;
          default:
            this.EquipmentType = 'General';
            break;
        }
        let elapsedTime = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        let distance = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const speed = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 4, true);
        const heartRate = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 6);
        const capStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);
        if (heartRate !== 0xff) {
          switch (capStateBF & 0x03) {
            case 3: {
              this.HeartRate = heartRate;
              this.HeartRateSource = 'HandContact';
              break;
            }
            case 2: {
              this.HeartRate = heartRate;
              this.HeartRateSource = 'EM';
              break;
            }
            case 1: {
              this.HeartRate = heartRate;
              this.HeartRateSource = 'ANT+';
              break;
            }
            default: {
              delete this.HeartRate;
              delete this.HeartRateSource;
              break;
            }
          }
        }

        elapsedTime /= 4;
        const oldElapsedTime = (this.ElapsedTime || 0) % 64;
        if (elapsedTime !== oldElapsedTime) {
          if (oldElapsedTime > elapsedTime) {
            // Hit rollover value
            elapsedTime += 64;
          }
        }
        this.ElapsedTime =
          (this.ElapsedTime || 0) + elapsedTime - oldElapsedTime;

        if (capStateBF & 0x04) {
          const oldDistance = (this.Distance || 0) % 256;
          if (distance !== oldDistance) {
            if (oldDistance > distance) {
              // Hit rollover value
              distance += 256;
            }
          }
          this.Distance = (this.Distance || 0) + distance - oldDistance;
        } else {
          delete this.Distance;
        }
        if (capStateBF & 0x08) {
          this.VirtualSpeed = speed / 1000;
          delete this.RealSpeed;
        } else {
          delete this.VirtualSpeed;
          this.RealSpeed = speed / 1000;
        }
        switch ((capStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (capStateBF & 0x80) {
          // lap
        }
        break;
      }
      case 0x11: {
        const cycleLen = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const incline = data.getInt16(Messages.BUFFER_INDEX_MSG_DATA + 4, true);
        const resistance = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 6);
        const capStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);
        if (cycleLen !== 0xff) {
          this.CycleLength = cycleLen / 100;
        }
        if (incline >= -10000 && incline <= 10000) {
          this.Incline = incline / 100;
        }
        if (resistance !== 0xff) {
          this.Resistance = resistance;
        }
        switch ((capStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (capStateBF & 0x80) {
          // lap
        }
        break;
      }
      case 0x12: {
        const mets = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 2, true);
        const caloricbr = data.getUint16(
          Messages.BUFFER_INDEX_MSG_DATA + 4,
          true
        );
        const calories = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 6);
        const capStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);
        if (mets !== 0xffff) {
          this.METs = mets / 100;
        }
        if (caloricbr !== 0xffff) {
          this.CaloricBurnRate = caloricbr / 10;
        }
        if (capStateBF & 0x01) {
          this.Calories = calories;
        }
        switch ((capStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (capStateBF & 0x80) {
          // lap
        }
        break;
      }
      case 0x13: {
        const cadence = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 4);
        let negDistance = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 5);
        let posDistance = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 6);
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (cadence !== 0xff) {
          this.Cadence = cadence;
        }

        if (flagStateBF & 0x02) {
          const oldNegDistance = (this.DescendedDistance || 0) % 256;
          if (negDistance !== oldNegDistance) {
            if (oldNegDistance > negDistance) {
              negDistance += 256;
            }
          }
          this.DescendedDistance =
            (this.DescendedDistance || 0) + negDistance - oldNegDistance;
        }

        if (flagStateBF & 0x01) {
          const oldPosDistance = (this.AscendedDistance || 0) % 256;
          if (posDistance !== oldPosDistance) {
            if (oldPosDistance > posDistance) {
              posDistance += 256;
            }
          }
          this.AscendedDistance =
            (this.AscendedDistance || 0) + posDistance - oldPosDistance;
        }

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x14: {
        let posDistance = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        let strides = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const cadence = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 4);
        const power = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 5, true);
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (cadence !== 0xff) {
          this.Cadence = cadence;
        }

        if (power !== 0xffff) {
          this.InstantaneousPower = power;
        }

        if (flagStateBF & 0x02) {
          const oldPosDistance = (this.AscendedDistance || 0) % 256;
          if (posDistance !== oldPosDistance) {
            if (oldPosDistance > posDistance) {
              posDistance += 256;
            }
          }
          this.AscendedDistance =
            (this.AscendedDistance || 0) + posDistance - oldPosDistance;
        }

        if (flagStateBF & 0x01) {
          const oldStrides = (this.Strides || 0) % 256;
          if (strides !== oldStrides) {
            if (oldStrides > strides) {
              strides += 256;
            }
          }
          this.Strides = (this.Strides || 0) + strides - oldStrides;
        }

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x16: {
        let strokes = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const cadence = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 4);
        const power = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 5, true);
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (cadence !== 0xff) {
          this.Cadence = cadence;
        }

        if (power !== 0xffff) {
          this.InstantaneousPower = power;
        }

        if (flagStateBF & 0x01) {
          const oldStrokes = (this.Strokes || 0) % 256;
          if (strokes !== oldStrokes) {
            if (oldStrokes > strokes) {
              strokes += 256;
            }
          }
          this.Strokes = (this.Strokes || 0) + strokes - oldStrokes;
        }

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x17: {
        let strides = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const cadence = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 4);
        const power = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 5, true);
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (cadence !== 0xff) {
          this.Cadence = cadence;
        }

        if (power !== 0xffff) {
          this.InstantaneousPower = power;
        }

        if (flagStateBF & 0x01) {
          const oldStrides = (this.Strides || 0) % 256;
          if (strides !== oldStrides) {
            if (oldStrides > strides) {
              strides += 256;
            }
          }
          this.Strides = (this.Strides || 0) + strides - oldStrides;
        }

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x18: {
        let strides = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const cadence = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 4);
        const power = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 5, true);
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (cadence !== 0xff) {
          this.Cadence = cadence;
        }

        if (power !== 0xffff) {
          this.InstantaneousPower = power;
        }

        if (flagStateBF & 0x01) {
          const oldStrides = (this.Strides || 0) % 256;
          if (strides !== oldStrides) {
            if (oldStrides > strides) {
              strides += 256;
            }
          }
          this.Strides = (this.Strides || 0) + strides - oldStrides;
        }

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x19: {
        const oldEventCount = this._EventCount0x19 || 0;

        let eventCount = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        const cadence = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        let accPower = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 3, true);
        const power =
          data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 5, true) & 0xfff;
        const trainerStatus =
          data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 6) >> 4;
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (eventCount !== oldEventCount) {
          this._EventCount0x19 = eventCount;
          if (oldEventCount > eventCount) {
            // Hit rollover value
            eventCount += 255;
          }
        }

        if (cadence !== 0xff) {
          this.Cadence = cadence;
        }

        if (power !== 0xfff) {
          this.InstantaneousPower = power;

          const oldAccPower = (this.AccumulatedPower || 0) % 65536;
          if (accPower !== oldAccPower) {
            if (oldAccPower > accPower) {
              accPower += 65536;
            }
          }
          this.AccumulatedPower =
            (this.AccumulatedPower || 0) + accPower - oldAccPower;

          this.AveragePower =
            (accPower - oldAccPower) / (eventCount - oldEventCount);
        }

        this.TrainerStatus = trainerStatus;

        switch (flagStateBF & 0x03) {
          case 0:
            this.TargetStatus = 'OnTarget';
            break;
          case 1:
            this.TargetStatus = 'LowSpeed';
            break;
          case 2:
            this.TargetStatus = 'HighSpeed';
            break;
          default:
            delete this.TargetStatus;
            break;
        }

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x1a: {
        const oldEventCount = this._EventCount0x1A || 0;

        let eventCount = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        let wheelTicks = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        let accWheelPeriod = data.getUint16(
          Messages.BUFFER_INDEX_MSG_DATA + 3,
          true
        );
        let accTorque = data.getUint16(
          Messages.BUFFER_INDEX_MSG_DATA + 5,
          true
        );
        const flagStateBF = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (eventCount !== oldEventCount) {
          this._EventCount0x1A = eventCount;
          if (oldEventCount > eventCount) {
            // Hit rollover value
            eventCount += 255;
          }
        }

        const oldWheelTicks = (this.WheelTicks || 0) % 256;
        if (wheelTicks !== oldWheelTicks) {
          if (oldWheelTicks > wheelTicks) {
            wheelTicks += 65536;
          }
        }
        this.WheelTicks = (this.WheelTicks || 0) + wheelTicks - oldWheelTicks;

        const oldWheelPeriod = (this.WheelPeriod || 0) % 256;
        if (accWheelPeriod !== oldWheelPeriod) {
          if (oldWheelPeriod > accWheelPeriod) {
            accWheelPeriod += 65536;
          }
        }
        this.WheelPeriod =
          (this.WheelPeriod || 0) + accWheelPeriod - oldWheelPeriod;

        const oldTorque = (this.Torque || 0) % 256;
        if (accTorque !== oldTorque) {
          if (oldTorque > accTorque) {
            accTorque += 65536;
          }
        }
        this.Torque = (this.Torque || 0) + accTorque - oldTorque;

        switch ((flagStateBF & 0x70) >> 4) {
          case 1:
            this.State = 'OFF';
            break;
          case 2:
            this.State = 'READY';
            this.resetState();
            break;
          case 3:
            this.State = 'IN_USE';
            break;
          case 4:
            this.State = 'FINISHED';
            break;
          default:
            delete this.State;
            break;
        }
        if (flagStateBF & 0x80) {
          // lap
        }

        break;
      }
      case 0x50: {
        this.HwVersion = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        this.ManId = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 4, true);
        this.ModelNum = data.getUint16(
          Messages.BUFFER_INDEX_MSG_DATA + 6,
          true
        );
        break;
      }
      case 0x51: {
        const swRevSup = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        const swRevMain = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const serial = data.getInt32(Messages.BUFFER_INDEX_MSG_DATA + 4, true);

        this.SwVersion = swRevMain;

        if (swRevSup !== 0xff) {
          this.SwVersion += swRevSup / 1000;
        }

        if (serial !== 0xffffffff) {
          this.SerialNumber = serial;
        }

        break;
      }
      case 0x56: {
        const idx = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 1);
        const tot = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
        const chState = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 3);
        const devId = data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 4, true);
        const trType = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 6);
        const devType = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 7);

        if (idx === 0) {
          this.PairedDevices = [];
        }

        if (tot > 0) {
          this.PairedDevices.push({
            id: devId,
            type: devType,
            paired: !!(chState & 0x80),
          });
        }

        break;
      }
      default:
        break;
    }

    return this;
  }
}
