const Ant = require('./build/ant');
const HRS = require('./build/heart-rate-sensors');
const SSD = require('./build/stride-speed-distance-sensors');
const SC = require('./build/speed-cadence-sensors');
const S = require('./build/speed-sensors');
const C = require('./build/cadence-sensors');
const BP = require('./build/bicycle-power-sensors');
const FE = require('./build/fitness-equipment-sensors');
const MO = require('./build/muscle-oxygen-sensors');
const E = require('./build/environment-sensors');

module.exports = {
	GarminStick2: Ant.GarminStick2,
	GarminStick3: Ant.GarminStick3,
	HeartRateSensor: HRS.HeartRateSensor,
	HeartRateScanner: HRS.HeartRateScanner,
	StrideSpeedDistanceSensor: SSD.StrideSpeedDistanceSensor,
	StrideSpeedDistanceScanner: SSD.StrideSpeedDistanceScanner,
	SpeedCadenceSensor: SC.SpeedCadenceSensor,
	SpeedCadenceScanner: SC.SpeedCadenceScanner,
	SpeedSensor: S.SpeedSensor,
	SpeedScanner: S.SpeedScanner,
	CadenceSensor: C.CadenceSensor,
	CadenceScanner: C.CadenceScanner,
	BicyclePowerSensor: BP.BicyclePowerSensor,
	BicyclePowerScanner: BP.BicyclePowerScanner,
	FitnessEquipmentSensor: FE.FitnessEquipmentSensor,
	FitnessEquipmentScanner: FE.FitnessEquipmentScanner,
	MuscleOxygenSensor: MO.MuscleOxygenSensor,
	MuscleOxygenScanner: MO.MuscleOxygenScanner,
	EnvironmentSensor: E.EnvironmentSensor,
	EnvironmentScanner: E.EnvironmentScanner,
};
