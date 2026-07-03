# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-07-04

### Added

- Added a redesigned `USBDriver` API with static factories for requesting,
  reusing, or wrapping WebUSB devices.
- Added typed `data`, `attached`, `detached`, and `eventData` events for
  sensors and scanners.
- Added immutable, camelCase state snapshots for ANT+ profile data.
- Added pure decoder exports for supported profiles so recorded data can be
  tested or replayed without USB hardware.
- Added support modules for typed events, cancellation, structured errors, and
  WebUSB test fakes.
- Added Vitest coverage for message encoding, driver behavior, event handling,
  and ANT+ profile decoders.

### Changed

- Changed the package to ESM-only with an `exports` map and Node.js 20+
  engine metadata.
- Changed `open()` to resolve once the ANT+ stick startup handshake completes,
  so callers can attach sensors immediately after awaiting it.
- Changed sensor attachment from `attachSensor(channel, deviceID)` to
  `attach({ channel, deviceId, transmissionType, timeout })`.
- Changed profile-specific events such as `hbData`, `powerData`, and `envData`
  to a single typed `data` event.
- Changed FitnessEquipment control commands to return `Promise<boolean>`
  acknowledgement results instead of using callbacks.
- Updated the example app to use the v3 driver, sensor, and state APIs.
- Updated CI to run check, typecheck, test, and build on modern Node.js
  versions.

### Fixed

- Fixed ANT+ USB device filtering so both vendor ID and product ID must match
  a supported stick.
- Improved protocol and channel-state failures by throwing `Error` subclasses
  instead of strings.

### Removed

- Removed the `GarminStick2` and `GarminStick3` classes. Use
  `USBDriver.requestDevice()`, `USBDriver.fromPairedDevice()`, or
  `USBDriver.fromDevice()` instead.
- Removed legacy PascalCase state fields in favor of readonly camelCase state.
- Removed the old untyped event emitter and legacy sensor/scanner class split.
- Removed CommonJS-style package entry assumptions by publishing through the
  ESM `exports` map.

### Technical

- Upgraded development tooling, including Biome, TypeScript, Vite, and Vitest.
- Added a dedicated build TypeScript configuration that excludes tests and test
  fakes from published output.
- Updated README migration guidance for v2 users moving to v3.

[Unreleased]: https://github.com/8beeeaaat/web-ant-plus/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/8beeeaaat/web-ant-plus/compare/v2.1.0...v3.0.0
