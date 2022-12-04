import { useEffect, useState } from 'react';
import {
  BicyclePowerSensor,
  GarminStick3,
  HeartRateSensor,
  SpeedCadenceSensor,
} from '../../src';
import { Constants } from '../../src/Constants';
import { GarminStick2 } from '../../src/GarminStick2';
import { Messages } from '../../src/Messages';
import { BicyclePowerSensorState } from '../../src/sensors/BicyclePowerSensorState';
import { HeartRateSensorState } from '../../src/sensors/HeartRateSensorState';
import { SpeedCadenceSensorState } from '../../src/sensors/SpeedCadenceSensorState';
import './App.css';
import reactLogo from './assets/react.svg';

// choose the stick type you want to use
const STICK: typeof GarminStick2 | typeof GarminStick3 = GarminStick2;

function App() {
  const [stick, setStick] = useState<GarminStick2 | GarminStick3>();
  const [heartRateSensor, setHeartRateSensor] = useState<HeartRateSensor>();
  const [speedCadenceSensor, setSpeedCadenceSensor] =
    useState<SpeedCadenceSensor>();
  const [bicyclePowerSensor, setBicyclePowerSensor] =
    useState<BicyclePowerSensor>();

  const [connected, setConnected] = useState(stick?.isScanning());
  const [heartbeat, setHeartbeat] = useState(0);
  const [hrState, setHRState] = useState<Array<HeartRateSensorState>>([]);
  const [speedState, setSpeedState] = useState<Array<SpeedCadenceSensorState>>(
    []
  );
  const [powerState, setPowerState] = useState<Array<BicyclePowerSensorState>>(
    []
  );

  useEffect(() => {
    if (!stick) {
      setStick(new STICK());
      return;
    }
    if (heartRateSensor) {
      heartRateSensor.on('attached', () =>
        console.log('heartRateSensor attached')
      );
      heartRateSensor.on('detached', () =>
        console.log('heartRateSensor detached')
      );

      heartRateSensor.on('hbData', onHeartRateData);
    } else {
      setHeartRateSensor(new HeartRateSensor(stick));
    }
    if (speedCadenceSensor) {
      speedCadenceSensor.on('attached', () =>
        console.log('speedCadenceSensor attached')
      );
      speedCadenceSensor.on('detached', () =>
        console.log('speedCadenceSensor detached')
      );
      speedCadenceSensor.setWheelCircumference(2.12);

      speedCadenceSensor.on('speedData', onSpeedData);
    } else {
      setSpeedCadenceSensor(new SpeedCadenceSensor(stick));
    }

    if (bicyclePowerSensor) {
      bicyclePowerSensor.on('attached', () =>
        console.log('bicyclePowerSensor attached')
      );
      bicyclePowerSensor.on('detached', () =>
        console.log('bicyclePowerSensor detached')
      );

      bicyclePowerSensor.on('powerData', onBicyclePowerData);
    } else {
      setBicyclePowerSensor(new BicyclePowerSensor(stick));
    }
  }, [stick, heartRateSensor, speedCadenceSensor, bicyclePowerSensor]);

  useEffect(() => {
    if (heartbeat > 0) {
      return;
    }
    stick?.write(Messages.requestMessage(0, Constants.MESSAGE_TX_SYNC));
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

  async function handleClickSearchDevice() {
    console.log('searching...');
    try {
      if (!stick) {
        throw new Error('stick not found');
      }
      stick.once('startup', async () => {
        try {
          console.log('Stick startup', stick);
          heartRateSensor ? await heartRateSensor.attachSensor(0, 0) : null;
          speedCadenceSensor
            ? await speedCadenceSensor.attachSensor(1, 0)
            : null;
          bicyclePowerSensor
            ? await bicyclePowerSensor.attachSensor(2, 0)
            : null;
          setConnected(true);
        } catch (error) {
          throw error;
        }
      });
      stick.once('shutdown', async () => {
        console.log('Stick shutdown');
      });
      await stick.open();
    } catch (error) {
      console.error(error);
    }
  }

  function handleClickClose() {
    console.log('closing...');
    try {
      (async () => {
        const close = await stick?.reset();
        await stick?.close();
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

  const newestHRState = hrState.length
    ? hrState[hrState.length - 1]
    : undefined;
  const newestSpeedState = speedState.length
    ? speedState[speedState.length - 1]
    : undefined;

  const newestPowerState = powerState.length
    ? powerState[powerState.length - 1]
    : undefined;

  const sumCalculatedCadence = powerState.reduce<number>((sum, state) => {
    if (state && state.Cadence) {
      return sum + state.Cadence / 3;
    }
    return sum;
  }, 0);

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
