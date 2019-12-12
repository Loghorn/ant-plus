'use strict';

const Ant = require('../ant-plus');
const stick = new Ant.GarminStick2();

const hrScanner = new Ant.HeartRateScanner(stick);
hrScanner.on('hbData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});
hrScanner.on('attached', () => {
	speedCadenceScanner.scan();
	speedScanner.scan();
	cadenceScanner.scan();
	fitnessEquipmentScanner.scan();
	environmentScanner.scan();
});

const environmentScanner = new Ant.EnvironmentScanner(stick);
environmentScanner.on('envData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});

const fitnessEquipmentScanner = new Ant.FitnessEquipmentScanner(stick);
fitnessEquipmentScanner.on('fitnessData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});

const speedCadenceScanner = new Ant.SpeedCadenceScanner(stick);
speedCadenceScanner.on('speedData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});
speedCadenceScanner.on('cadenceData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});

const speedScanner = new Ant.SpeedScanner(stick);
speedScanner.on('speedData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});

const cadenceScanner = new Ant.CadenceScanner(stick);
cadenceScanner.on('cadenceData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});


stick.on('startup', function() {
	console.log('startup');
	hrScanner.scan();
});

if (!stick.open()) {
	console.log('Stick not found!');
}
