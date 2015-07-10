/* global HeartRateSensor */
var Ant = require('./build/ant.js');
var HRS = require('./build/heart-rate-sensors.js');
var SSD = require('./build/stride-speed-distance-sensors.js');

module.exports = {
    GarminStick2: Ant.GarminStick2,
    GarminStick3: Ant.GarminStick3,
	HeartRateSensor: HRS.HeartRateSensor,
	HeartRateScanner: HRS.HeartRateScanner,
	StrideSpeedDistanceSensor: SSD.StrideSpeedDistanceSensor,
	StrideSpeedDistanceScanner: SSD.StrideSpeedDistanceScanner,
};