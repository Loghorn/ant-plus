var Ant = require('./ant').Ant;

var stick = new Ant.GarminStick3;

var sensor1 = new Ant.HeartRateSensor(stick);

var did = 0;

sensor1.on('hbdata', (data) => {
	console.log('sensor 1: ', data.DeviceID, data.ComputedHeartRate);
	if (data.DeviceID !== 0 && did === 0) {
		did = data.DeviceID;
		console.log('detaching...');
		sensor1.detach();
		sensor1.once('detached', () => {
			sensor1.attach(0, did);
		});
	}
});

sensor1.on('attached', () => console.log('sensor1 attached'));
sensor1.on('detached', () => console.log('sensor1 detached'));

var sensor2 = new Ant.HeartRateSensor(stick);

sensor2.on('hbdata', (data) => {
	console.log('sensor 2: ', data.DeviceID, data.ComputedHeartRate);
});

sensor2.on('attached', () => console.log('sensor2 attached'));
sensor2.on('detached', () => console.log('sensor2 detached'));

var scanner = new Ant.HeartRateScanner(stick);

scanner.on('hbdata', (data) => {
	console.log('scanner: ', data.DeviceID, data.ComputedHeartRate);
});

scanner.on('attached', () => console.log('scanner attached'));
scanner.on('detached', () => console.log('scanner detached'));

stick.on('startup', () => {
	console.log('startup');

	console.log('Max channels:', stick.maxChannels);

	sensor1.attach(0, 0);

	setTimeout((data) => {
		sensor2.attach(1, 0);
	}, 2000);

	setTimeout(() => {
		sensor1.once('detached', () => sensor2.detach());
		sensor2.once('detached', () => {
			scanner.scan();
		});
		sensor1.detach();
	}, 30000);
});

if (!stick.open()) {
	console.log('Stick not found!');
} else {
	setTimeout(() => stick.close(), 60000);
}
