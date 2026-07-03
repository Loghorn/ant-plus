import { useRef, useState } from "react";
import {
  BicyclePowerSensor,
  type BicyclePowerSensorState,
  HeartRateSensor,
  type HeartRateSensorState,
  SpeedCadenceSensor,
  type SpeedCadenceSensorState,
  USBDriver,
} from "../../src/index.ts";
import "./App.css";
import reactLogo from "./assets/react.svg";

function App() {
  const driverRef = useRef<USBDriver | null>(null);
  const [connected, setConnected] = useState(false);
  const [hrState, setHRState] = useState<HeartRateSensorState>();
  const [speedState, setSpeedState] = useState<SpeedCadenceSensorState>();
  const [powerState, setPowerState] = useState<BicyclePowerSensorState>();
  const [totalCadence, setTotalCadence] = useState(0);

  async function handleClickSearchDevice() {
    console.log("searching...");
    try {
      const driver = await USBDriver.requestDevice();
      driverRef.current = driver;

      driver.on("shutdown", () => {
        console.log("Stick shutdown");
      });
      driver.on("error", (error) => {
        console.error("Driver error", error);
      });

      await driver.open();
      console.log("Stick startup", driver);

      const heartRateSensor = new HeartRateSensor(driver);
      heartRateSensor.on("attached", () =>
        console.log("heartRateSensor attached"),
      );
      heartRateSensor.on("detached", () =>
        console.log("heartRateSensor detached"),
      );
      heartRateSensor.on("data", setHRState);

      const speedCadenceSensor = new SpeedCadenceSensor(driver);
      speedCadenceSensor.wheelCircumference = 2.12;
      speedCadenceSensor.on("data", setSpeedState);

      const bicyclePowerSensor = new BicyclePowerSensor(driver);
      bicyclePowerSensor.on("data", (state) => {
        setPowerState(state);
        const cadence = state.cadence;
        if (cadence !== undefined) {
          setTotalCadence((prev) => prev + cadence / 3);
        }
      });

      await heartRateSensor.attach({ channel: 0, deviceId: 0 });
      await speedCadenceSensor.attach({ channel: 1, deviceId: 0 });
      await bicyclePowerSensor.attach({ channel: 2, deviceId: 0 });
      setConnected(true);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleClickClose() {
    console.log("closing...");
    try {
      await driverRef.current?.close();
    } catch (error) {
      console.error(error);
    } finally {
      driverRef.current = null;
      setConnected(false);
    }
  }

  function meterPerSecToKmPerHour(mps: number) {
    return mps * 3.6;
  }

  return (
    <div className="App">
      <div>
        <a href="https://reactjs.org" target="_blank" rel="noreferrer">
          <img
            src={reactLogo}
            className="logo react"
            alt="React logo"
            style={{
              transform: `rotate(${totalCadence}deg) scale(${
                powerState?.power ? powerState.power / 200 : 1
              })`,
            }}
          />
        </a>
      </div>
      <h1
        style={{
          display: "flex",
          alignItems: "start",
        }}
      >
        WebUSB ANT+
        <span
          style={{
            fontSize: "0.5em",
          }}
        >
          ®
        </span>
      </h1>
      <div className="card">
        {connected ? (
          <>
            <button type="button" onClick={handleClickClose}>
              Disconnect
            </button>

            <dl>
              <dt>
                <b>Heart Rate</b>
              </dt>
              <dd
                style={{
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "auto",
                }}
              >
                {hrState?.computedHeartRate}
                <span
                  style={{
                    fontSize: "0.5em",
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
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "auto",
                }}
              >
                {meterPerSecToKmPerHour(
                  speedState?.calculatedSpeed || 0,
                ).toFixed(1)}
                <span
                  style={{
                    fontSize: "0.5em",
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
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "auto",
                }}
              >
                {powerState?.cadence}
                <span
                  style={{
                    fontSize: "0.5em",
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
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "auto",
                }}
              >
                {powerState?.power?.toFixed(1)}
                <span
                  style={{
                    fontSize: "0.5em",
                  }}
                >
                  w
                </span>
              </dd>
            </dl>
          </>
        ) : (
          <button type="button" onClick={handleClickSearchDevice}>
            Search ANT+ Receiver
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
