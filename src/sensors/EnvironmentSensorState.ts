/*
 * Copyright (c) 2019 Tom Cosgrove
 * Copyright (c) 2015 Alessandro Vergani
 *
 * This file is licensed under the MIT License (MIT):
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Messages } from '../Messages';

export class EnvironmentSensorState {
  constructor(deviceId: number) {
    this.DeviceID = deviceId;
  }

  DeviceID: number;

  EventCount?: number;

  Temperature?: number;

  updateState(data: DataView): EnvironmentSensorState {
    const page = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA);
    if (page === 1) {
      this.EventCount = data.getUint8(Messages.BUFFER_INDEX_MSG_DATA + 2);
      this.Temperature =
        data.getUint16(Messages.BUFFER_INDEX_MSG_DATA + 6, true) / 100;
    }

    return this;
  }
}
