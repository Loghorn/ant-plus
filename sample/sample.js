var Ant = require('../ant-plus');

var stick = new Ant.GarminStick3;

var sensor1 = new Ant.HeartRateSensor(stick);

var dev_id = 0;

sensor1.on('hbdata', function (data) {
	console.log('sensor 1: ', data.DeviceID, data.ComputedHeartRate);
	if (data.DeviceID !== 0 && dev_id === 0) {
		dev_id = data.DeviceID;
		console.log('detaching...');
		sensor1.detach();
		sensor1.once('detached', function () {
			sensor1.attach(0, dev_id);
		});
	}
});

sensor1.on('attached', function () { console.log('sensor1 attached'); });
sensor1.on('detached', function () { console.log('sensor1 detached'); });

var sensor2 = new Ant.StrideSpeedDistanceSensor(stick);

sensor2.on('ssddata', function (data) {
	console.log('sensor 2: ', data.DeviceID, data);
});

sensor2.on('attached', function () { console.log('sensor2 attached'); });
sensor2.on('detached', function () { console.log('sensor2 detached'); });

var scanner = new Ant.HeartRateScanner(stick);

scanner.on('hbdata', function (data) {
	console.log('scanner: ', data.DeviceID, data.ComputedHeartRate, data.Rssi);
});

scanner.on('attached', function () { console.log('scanner attached'); });
scanner.on('detached', function () { console.log('scanner detached'); });

stick.on('startup', function () {
	console.log('startup');

	console.log('Max channels:', stick.maxChannels);

	sensor1.attach(0, 0);

	setTimeout(function (data) {
		sensor2.attach(1, 0);
	}, 2000);

	setTimeout(function () {
		sensor1.once('detached', function () { sensor2.detach(); });
		sensor2.once('detached', function () {
			scanner.scan();
		});
		sensor1.detach();
	}, 30000);
});

stick.on('shutdown', function () { console.log('shutdown'); });

if (!stick.open()) {
	console.log('Stick not found!');
} else {
	setTimeout(function () { stick.close(); }, 60000);
}
