'use strict';

const Ant = require('../ant-plus');
const stick = new Ant.GarminStick2();

const fitnessEquipmentSensor = new Ant.FitnessEquipmentSensor(stick);

fitnessEquipmentSensor.on('fitnessData', data => {
	console.log(`id: ${data.DeviceID}`);
	console.dir(data);
});

fitnessEquipmentSensor.on('attached', function() {
	console.log('sensor attached');

	fitnessEquipmentSensor.setUserConfiguration(82.3, 12.7, 70.5, function() {
		console.log('set User Weight = 82.3kg, Bike Weight = 12.7kg, Wheel = 70.5cm');
	});
	fitnessEquipmentSensor.setBasicResistance(20.5, function() {
		console.log('set resistance to 20.5%');
	});
	fitnessEquipmentSensor.setTrackResistance(1.1, function() {
		console.log('set slope to 1.1%');
	});
	fitnessEquipmentSensor.setWindResistance(0.51, function() {
		console.log('set wind resistance coeff 0.51 kg/m');
		simulateTraining(30, 5, Date.now() + 1 * 60 * 1000);
	});
});

function simulateTraining(targetPower, increment, simulationEnd) {
	if (Date.now() > simulationEnd) {
		console.log('Simulation ended');
		stick.close();
		return;
	}

	const tp = targetPower;
	fitnessEquipmentSensor.setTargetPower(tp, function() {
		console.log('set target power to ' + tp + 'W');
	});

	if (targetPower >= 200 || targetPower <= 20) {
		increment = -1 * increment;
	}
	targetPower += increment;

	setTimeout(simulateTraining, 5000, targetPower, increment, simulationEnd);
}

stick.on('startup', function() {
	console.log('startup');
	fitnessEquipmentSensor.attach(0, 0);
});

if (!stick.open()) {
	console.log('Stick not found!');
}
