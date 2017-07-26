/* global HeartRateSensor */
var Ant = require('./build/ant');
var HRS = require('./build/heart-rate-sensors');
var SSD = require('./build/stride-speed-distance-sensors');
var SC = require('./build/speed-cadence-sensors');
var PS = require('./build/bicyle-power-sensor');

module.exports = {
	GarminStick2: Ant.GarminStick2,
	GarminStick3: Ant.GarminStick3,
	HeartRateSensor: HRS.HeartRateSensor,
	HeartRateScanner: HRS.HeartRateScanner,
	StrideSpeedDistanceSensor: SSD.StrideSpeedDistanceSensor,
	StrideSpeedDistanceScanner: SSD.StrideSpeedDistanceScanner,
	SpeedCadenceSensor: SC.SpeedCadenceSensor,
	SpeedCadenceScanner: SC.SpeedCadenceScanner,
	BicylePowerSensor: PS.BicylePowerSensor,
	BicyclePowerScanner: PS.BicyclePowerScanner
};
