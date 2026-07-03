# Migrating from v2

v3 is a full redesign. The main breaking changes:

- ESM-only package with an `exports` map.
- `GarminStick2` / `GarminStick3` classes are gone — use the `USBDriver` static factories (they filter for both stick models).
- `stick.open()` now resolves once the stick is ready (after the startup handshake) instead of blocking until the stick is closed.
- `sensor.attachSensor(channel, deviceID)` became `sensor.attach({ channel, deviceId })` and resolves once the channel is open.
- All profile-specific events (`hbData`, `powerData`, `envData`, ...) are unified into a single typed `data` event.
- State fields are camelCase and readonly (`ComputedHeartRate` → `computedHeartRate`); every `data` event delivers an immutable snapshot.
- FitnessEquipment control commands return `Promise<boolean>` instead of taking callbacks.
- Errors are `Error` subclasses (`AntPlusError`, `ChannelStateError`, `DeviceNotFoundError`, `ProtocolError`) instead of thrown strings.

## Migration helper

This repository includes a best-effort migration helper for common v2 API usage:

```sh
npm run migrate:v2-to-v3 -- path/to/your/source
npm run migrate:v2-to-v3 -- --write path/to/your/source
npx -p web-ant-plus web-ant-plus-migrate-v2-to-v3 --write path/to/your/source
```

The first command is a dry run. The `--write` form updates files in place. The
`npx` form runs the helper from the published package. Review the result
afterwards, especially code that waits for the old `startup` event, because
`driver.open()` now resolves after startup.
