'use strict';

let Ant = require('..');
let stick = new Ant.GarminStick2();
let speedCadenceSensor = new Ant.SpeedCadenceSensor(stick);
speedCadenceSensor.setWheelCircumference(2.120); //Wheel circumference in meters

speedCadenceSensor.on('speedData', data => {
  console.log(`speed: ${data.CalculatedSpeed}`);
});

speedCadenceSensor.on('cadenceData', data => {
  console.log(`cadence: ${data.CalculatedCadence}`);
});


stick.on('startup', function () {
	console.log('startup');
	speedCadenceSensor.attach(0, 0);
});

if (!stick.open()) {
	console.log('Stick not found!');
}
