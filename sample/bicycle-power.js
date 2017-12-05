'use strict';

let Ant = require('../ant-plus');
let stick = new Ant.GarminStick2();
let bicyclePowerSensor = new Ant.BicyclePowerSensor(stick);


bicyclePowerSensor.on('powerData', data => {
  console.log(`id: ${data.DeviceID}, cadence: ${data.Cadence}, power: ${data.Power}`);
});


stick.on('startup', function () {
	console.log('startup');
	bicyclePowerSensor.attach(0, 0);
});

if (!stick.open()) {
	console.log('Stick not found!');
}
