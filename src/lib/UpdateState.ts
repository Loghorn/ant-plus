import { Page } from '../ant';
import { BicyclePowerScanner } from '../sensors/BicyclePowerScanner';
import { BicyclePowerScanState } from '../sensors/BicyclePowerScanState';
import { BicyclePowerSensor } from '../sensors/BicyclePowerSensor';
import { BicyclePowerSensorState } from '../sensors/BicyclePowerSensorState';
import { CadenceScanner } from '../sensors/CadenceScanner';
import { CadenceScanState } from '../sensors/CadenceScanState';
import { CadenceSensor } from '../sensors/CadenceSensor';
import { CadenceSensorState } from '../sensors/CadenceSensorState';
import { EnvironmentScanner } from '../sensors/EnvironmentScanner';
import { EnvironmentScanState } from '../sensors/EnvironmentScanState';
import { EnvironmentSensor } from '../sensors/EnvironmentSensor';
import { EnvironmentSensorState } from '../sensors/EnvironmentSensorState';
import { FitnessEquipmentScanner } from '../sensors/FitnessEquipmentScanner';
import { FitnessEquipmentScanState } from '../sensors/FitnessEquipmentScanState';
import { FitnessEquipmentSensor } from '../sensors/FitnessEquipmentSensor';
import { FitnessEquipmentSensorState } from '../sensors/FitnessEquipmentSensorState';
import { HeartRateScanner } from '../sensors/HeartRateScanner';
import { HeartRateScanState } from '../sensors/HeartRateScanState';
import { HeartRateSensor } from '../sensors/HeartRateSensor';
import { HeartRateSensorState } from '../sensors/HeartRateSensorState';
import { MuscleOxygenScanner } from '../sensors/MuscleOxygenScanner';
import { MuscleOxygenScanState } from '../sensors/MuscleOxygenScanState';
import { MuscleOxygenSensor } from '../sensors/MuscleOxygenSensor';
import { MuscleOxygenSensorState } from '../sensors/MuscleOxygenSensorState';
import { SpeedCadenceScanner } from '../sensors/SpeedCadenceScanner';
import { SpeedCadenceScanState } from '../sensors/SpeedCadenceScanState';
import { SpeedCadenceSensor } from '../sensors/SpeedCadenceSensor';
import { SpeedCadenceSensorState } from '../sensors/SpeedCadenceSensorState';
import { SpeedScanner } from '../sensors/SpeedScanner';
import { SpeedScanState } from '../sensors/SpeedScanState';
import { SpeedSensor } from '../sensors/SpeedSensor';
import { SpeedSensorState } from '../sensors/SpeedSensorState';
import { StrideSpeedDistanceScanner } from '../sensors/StrideSpeedDistanceScanner';
import { StrideSpeedDistanceScanState } from '../sensors/StrideSpeedDistanceScanState';
import { StrideSpeedDistanceSensor } from '../sensors/StrideSpeedDistanceSensor';
import { StrideSpeedDistanceSensorState } from '../sensors/StrideSpeedDistanceSensorState';

export function updateBicyclePowerSensorState(
  sensor: BicyclePowerSensor | BicyclePowerScanner,
  state: BicyclePowerSensorState | BicyclePowerScanState,
  data: DataView
) {
  sensor.emit('powerData', state.updateState(data));
}

export function updateCadenceSensorState(
  sensor: CadenceSensor | CadenceScanner,
  state: CadenceSensorState | CadenceScanState,
  data: DataView
) {
  sensor.emit('cadenceData', state.updateState(data));
}

export function updateEnvironmentSensorState(
  sensor: EnvironmentSensor | EnvironmentScanner,
  state: EnvironmentSensorState | EnvironmentScanState,
  data: DataView
) {
  const updatedState = state.updateState(data);
  sensor.emit('envdata', updatedState);
  sensor.emit('envData', updatedState);
}

export function updateFitnessEquipmentSensorState(
  sensor: FitnessEquipmentSensor | FitnessEquipmentScanner,
  state: FitnessEquipmentSensorState | FitnessEquipmentScanState,
  data: DataView
) {
  sensor.emit('fitnessData', state.updateState(data));
}

export function resetFitnessEquipmentSensorState(
  state: FitnessEquipmentSensorState | FitnessEquipmentScanState
) {
  state.resetState();
}

export function updateHeartRateSensorState(
  sensor: HeartRateSensor | HeartRateScanner,
  state: HeartRateSensorState | HeartRateScanState,
  data: DataView,
  page: Page
) {
  const updatedState = state.updateState(data, page);
  sensor.emit('hbdata', updatedState);
  sensor.emit('hbData', updatedState);
}

export function updateMuscleOxygenSensorState(
  sensor: MuscleOxygenSensor | MuscleOxygenScanner,
  state: MuscleOxygenSensorState | MuscleOxygenScanState,
  data: DataView
) {
  const updatedState = state.updateState(data);
  if (updatedState) {
    sensor.emit('oxygenData', updatedState);
  }
}

export function updateSpeedCadenceSensorState(
  sensor: SpeedCadenceSensor | SpeedCadenceScanner,
  state: SpeedCadenceSensorState | SpeedCadenceScanState,
  data: DataView
) {
  const { updatedState, resultType } = state.updateState(
    data,
    sensor.wheelCircumference
  );
  switch (resultType) {
    case 'both':
      sensor.emit('cadenceData', updatedState);
      sensor.emit('speedData', updatedState);
      break;
    case 'cadence':
      sensor.emit('cadenceData', updatedState);
      break;
    case 'speed':
      sensor.emit('speedData', updatedState);
      break;
    default:
      break;
  }
}

export function updateSpeedSensorState(
  sensor: SpeedSensor | SpeedScanner,
  state: SpeedSensorState | SpeedScanState,
  data: DataView
) {
  const updatedState = state.updateState(data, sensor.wheelCircumference);
  if (updatedState) {
    sensor.emit('speedData', updatedState);
  }
}

export function updateStrideSpeedDistanceSensorState(
  sensor: StrideSpeedDistanceSensor | StrideSpeedDistanceScanner,
  state: StrideSpeedDistanceSensorState | StrideSpeedDistanceScanState,
  data: DataView
) {
  const updatedState = state.updateState(data);
  sensor.emit('ssddata', updatedState);
  sensor.emit('ssdData', updatedState);
}
