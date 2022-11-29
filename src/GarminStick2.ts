import { USBDriver } from './USBDriver';

export class GarminStick2 extends USBDriver {
  constructor() {
    super(0x0fcf, 0x1008);
  }
}
