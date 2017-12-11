'use strict';

const Ant = require('../ant-plus');
const stick = new Ant.GarminStick2();

const fitnessEquipmentSensor = new Ant.FitnessEquipmentSensor(stick);

fitnessEquipmentSensor.on('fitnessData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});

stick.on('startup', function() {
	console.log('startup');
	fitnessEquipmentSensor.attach(0, 0);
});

if (!stick.open()) {
	console.log('Stick not found!');
}
