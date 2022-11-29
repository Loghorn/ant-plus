import { useEffect, useState } from 'react';
import { Constants } from '../../src/Constants';
import { GarminStick2 } from '../../src/GarminStick2';
import { Messages } from '../../src/Messages';
import { BicyclePowerSensor } from '../../src/sensors/BicyclePowerSensor';
import { BicyclePowerSensorState } from '../../src/sensors/BicyclePowerSensorState';
import { HeartRateSensor } from '../../src/sensors/HeartRateSensor';
import { HeartRateSensorState } from '../../src/sensors/HeartRateSensorState';
import { SpeedCadenceSensor } from '../../src/sensors/SpeedCadenceSensor';
import { SpeedCadenceSensorState } from '../../src/sensors/SpeedCadenceSensorState';
import './App.css';
import reactLogo from './assets/react.svg';

function App() {
  const stick = new GarminStick2();
  const hrSensor = new HeartRateSensor(stick);
  const speedCadenceSensor = new SpeedCadenceSensor(stick);
  speedCadenceSensor.setWheelCircumference(2.12);
  const bicyclePowerSensor = new BicyclePowerSensor(stick);
  stick.on('startup', async () => {
    try {
      console.log('Stick startup');
      await hrSensor.attachSensor(0, 0);
      await speedCadenceSensor.attachSensor(1, 0);
      await bicyclePowerSensor.attachSensor(2, 0);
      setConnected(true);
    } catch (error) {
      console.error(error);
    }
  });
  const [connected, setConnected] = useState(stick.isScanning());
  const [heartbeat, setHeartbeat] = useState(0);
  const [hrState, setHRState] = useState<Array<HeartRateSensorState>>([]);
  const [speedState, setSpeedState] = useState<Array<SpeedCadenceSensorState>>(
    []
  );
  const [powerState, setPowerState] = useState<Array<BicyclePowerSensorState>>(
    []
  );

  const newestHRState = hrState.length
    ? hrState[hrState.length - 1]
    : undefined;
  const newestSpeedState = speedState.length
    ? speedState[speedState.length - 1]
    : undefined;

  const newestPowerState = powerState.length
    ? powerState[powerState.length - 1]
    : undefined;

  const sumComputedHeartRate = hrState.reduce<number>((sum, state) => {
    if (state && state.ComputedHeartRate) {
      return sum + state.ComputedHeartRate / 2;
    }
    return sum;
  }, 0);

  const sumCalculatedCadence = powerState.reduce<number>((sum, state) => {
    if (state && state.Cadence) {
      return sum + state.Cadence / 3;
    }
    return sum;
  }, 0);

  useEffect(() => {
    if (heartbeat > 0) {
      return;
    }
    stick.write(Messages.requestMessage(0, Constants.MESSAGE_TX_SYNC));
    setHeartbeat(0);
  }, [heartbeat]);

  const onHeartRateData = (state: HeartRateSensorState) => {
    console.log(state);
    setHRState((prev) => [...prev, state]);
    setHeartbeat((prev) => prev + 1);
  };

  const onSpeedData = (state: SpeedCadenceSensorState) => {
    console.log(state);
    setSpeedState((prev) => [...prev, state]);
    setHeartbeat((prev) => prev + 1);
  };

  const onBicyclePowerData = (state: BicyclePowerSensorState) => {
    console.log(state);
    setPowerState((prev) => [...prev, state]);
    setHeartbeat((prev) => prev + 1);
  };

  function handleClickSearchDevice() {
    console.log('searching...');
    try {
      (async () => {
        hrSensor.on('hbData', onHeartRateData);
        speedCadenceSensor.on('speedData', onSpeedData);
        bicyclePowerSensor.on('powerData', onBicyclePowerData);
        await stick.open();
      })();
    } catch (error) {
      console.error(error);
    }
  }

  function handleClickClose() {
    console.log('closing...');
    try {
      (async () => {
        const close = await stick.reset();
        console.log('close', close);
      })();
      setConnected(false);
    } catch (error) {
      console.error(error);
    }
  }

  function meterPerSecToKmPerHour(mps: number) {
    return mps * 3.6;
  }

  return (
    <div className='App'>
      <div>
        <a href='https://reactjs.org' target='_blank'>
          <img
            src={reactLogo}
            className='logo react'
            alt='React logo'
            style={{
              transform: `rotate(${sumCalculatedCadence}deg) scale(${
                newestPowerState?.Power ? newestPowerState.Power / 200 : 1
              })`,
            }}
          />
        </a>
      </div>
      <h1
        style={{
          display: 'flex',
          alignItems: 'start',
        }}
      >
        WebUSB ANT+
        <span
          style={{
            fontSize: '0.5em',
          }}
        >
          ®
        </span>
      </h1>
      <div className='card'>
        {connected ? (
          <>
            <button type='button' onClick={handleClickClose}>
              Disconnect
            </button>

            <dl>
              <dt>
                <b>Heart Rate</b>
              </dt>
              <dd
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 'auto',
                }}
              >
                {newestHRState?.ComputedHeartRate}
                <span
                  style={{
                    fontSize: '0.5em',
                  }}
                >
                  bpm
                </span>
              </dd>
              <dt>
                <b>CalculatedSpeed</b>
              </dt>
              <dd
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 'auto',
                }}
              >
                {meterPerSecToKmPerHour(
                  newestSpeedState?.CalculatedSpeed || 0
                ).toFixed(1)}
                <span
                  style={{
                    fontSize: '0.5em',
                  }}
                >
                  km/h
                </span>
              </dd>
              <dt>
                <b>Cadence</b>
              </dt>
              <dd
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 'auto',
                }}
              >
                {newestPowerState?.Cadence}
                <span
                  style={{
                    fontSize: '0.5em',
                  }}
                >
                  rpm
                </span>
              </dd>
              <dt>
                <b>Power</b>
              </dt>
              <dd
                style={{
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 'auto',
                }}
              >
                {newestPowerState?.Power?.toFixed(1)}
                <span
                  style={{
                    fontSize: '0.5em',
                  }}
                >
                  w
                </span>
              </dd>
            </dl>
          </>
        ) : (
          <button type='button' onClick={handleClickSearchDevice}>
            Search ANT+ Receiver
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
