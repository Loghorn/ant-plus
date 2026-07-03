#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "3.0.0";
const CODE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const EXCLUDED_DIRS = new Set([".git", "coverage", "dist", "node_modules"]);
const EXCLUDED_FILES = new Set(["package-lock.json"]);
const SELF = path.resolve(fileURLToPath(import.meta.url));

const EVENT_RENAMES = new Map([
  ["hbData", "data"],
  ["powerData", "data"],
  ["speedData", "data"],
  ["cadenceData", "data"],
  ["envData", "data"],
  ["fitnessData", "data"],
  ["ssdData", "data"],
]);

const STATE_FIELD_RENAMES = new Map([
  ["AccumulatedPower", "accumulatedPower"],
  ["AscendedDistance", "ascendedDistance"],
  ["AveragePower", "averagePower"],
  ["BatteryId", "batteryId"],
  ["BatteryLevel", "batteryLevel"],
  ["BatteryStatus", "batteryStatus"],
  ["BatteryVoltage", "batteryVoltage"],
  ["BeatCount", "beatCount"],
  ["BeatTime", "beatTime"],
  ["Cadence", "cadence"],
  ["CadenceEventTime", "cadenceEventTime"],
  ["CadenceFractional", "cadenceFractional"],
  ["CadenceInteger", "cadenceInteger"],
  ["CalculatedCadence", "calculatedCadence"],
  ["CalculatedDistance", "calculatedDistance"],
  ["CalculatedPower", "calculatedPower"],
  ["CalculatedSpeed", "calculatedSpeed"],
  ["CalculatedTorque", "calculatedTorque"],
  ["Calories", "calories"],
  ["CaloricBurnRate", "caloricBurnRate"],
  ["ComputedHeartRate", "computedHeartRate"],
  ["CumulativeCadenceRevolutionCount", "cumulativeCadenceRevolutionCount"],
  ["CumulativeSpeedRevolutionCount", "cumulativeSpeedRevolutionCount"],
  [
    "CurrentSaturatedHemoglobinPercentage",
    "currentSaturatedHemoglobinPercentage",
  ],
  ["CycleLength", "cycleLength"],
  ["DescendedDistance", "descendedDistance"],
  ["DeviceID", "deviceId"],
  ["DeviceId", "deviceId"],
  ["Distance", "distance"],
  ["DistanceFractional", "distanceFractional"],
  ["DistanceInteger", "distanceInteger"],
  ["ElapsedTime", "elapsedTime"],
  ["EnabledFeatures", "enabledFeatures"],
  ["EquipmentType", "equipmentType"],
  ["EventCount", "eventCount"],
  ["EventCount0x19", "eventCount0x19"],
  ["EventCount0x1A", "eventCount0x1A"],
  ["HeartRate", "heartRate"],
  ["HeartRateSource", "heartRateSource"],
  ["HwVersion", "hwVersion"],
  ["Incline", "incline"],
  ["InstantaneousPower", "instantaneousPower"],
  ["IntervalAverage", "intervalAverage"],
  ["IntervalMax", "intervalMax"],
  ["LeftPedalPower", "leftPedalPower"],
  ["ManId", "manId"],
  ["MeasurementInterval", "measurementInterval"],
  ["Mets", "mets"],
  ["ModelNum", "modelNum"],
  ["Motion", "motion"],
  ["Offset", "offset"],
  ["OperatingTime", "operatingTime"],
  ["PairedDevices", "pairedDevices"],
  ["PedalPower", "pedalPower"],
  ["Power", "power"],
  ["PreviousBeat", "previousBeat"],
  [
    "PreviousSaturatedHemoglobinPercentage",
    "previousSaturatedHemoglobinPercentage",
  ],
  ["RealSpeed", "realSpeed"],
  ["ReceivedAt", "receivedAt"],
  ["Resistance", "resistance"],
  ["RightPedalPower", "rightPedalPower"],
  ["Rssi", "rssi"],
  ["SerialNumber", "serialNumber"],
  ["SessionAverage", "sessionAverage"],
  ["Slope", "slope"],
  ["SpeedEventTime", "speedEventTime"],
  ["SpeedFractional", "speedFractional"],
  ["SpeedInteger", "speedInteger"],
  ["SpinDownTime", "spinDownTime"],
  ["State", "state"],
  ["Status", "status"],
  ["StrideCount", "strideCount"],
  ["Strides", "strides"],
  ["Strokes", "strokes"],
  ["SupportANTFS", "supportANTFS"],
  ["SupportedFeatures", "supportedFeatures"],
  ["SwVersion", "swVersion"],
  ["TargetStatus", "targetStatus"],
  ["Temperature", "temperature"],
  ["Threshold", "threshold"],
  ["TimeFractional", "timeFractional"],
  ["TimeInteger", "timeInteger"],
  ["TimeStamp", "timeStamp"],
  ["Torque", "torque"],
  ["TorqueTicksStamp", "torqueTicksStamp"],
  ["TotalHemoglobinConcentration", "totalHemoglobinConcentration"],
  ["TrainerStatus", "trainerStatus"],
  ["UpdateLatency", "updateLatency"],
  ["UtcTimeRequired", "utcTimeRequired"],
  ["VirtualSpeed", "virtualSpeed"],
  ["WheelPeriod", "wheelPeriod"],
  ["WheelTicks", "wheelTicks"],
  ["ZeroOffset", "zeroOffset"],
]);

function parseArgs(argv) {
  const options = {
    check: false,
    help: false,
    paths: [],
    write: false,
  };

  for (const arg of argv) {
    if (arg === "--check") {
      options.check = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.paths.push(arg);
    }
  }

  if (options.paths.length === 0) {
    options.paths.push(".");
  }

  return options;
}

function usage() {
  return `web-ant-plus v2 to v3 migration helper

Usage:
  npm run migrate:v2-to-v3 -- [--write] [paths...]
  node tools/migrate-v2-to-v3.mjs [--write] [paths...]

Options:
  --write   Rewrite files in place. Without this, the tool only reports.
  --check   Exit with code 1 when any migration change is needed.
  --help    Show this help.

The tool performs conservative text migrations for common v2 API usage:
  - GarminStick2/GarminStick3 imports and constructors
  - USBDriver factory method renames
  - attachSensor(channel, deviceID) -> attach({ channel, deviceId })
  - profile-specific data events -> "data"
  - setWheelCircumference(value) -> wheelCircumference = value
  - common PascalCase state fields -> camelCase fields

Review the output after running with --write. Some lifecycle migrations,
especially startup-event control flow, still need human review.`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const cwd = process.cwd();
  const files = await collectFiles(cwd, options.paths);
  const results = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const result = migrateSource(source);
    if (result.changed || result.notes.length > 0) {
      results.push({ file, ...result });
    }
    if (options.write && result.changed) {
      await writeFile(file, result.output);
    }
  }

  printReport(cwd, results, options);

  if (options.check && results.some((result) => result.changed)) {
    process.exitCode = 1;
  }
}

async function collectFiles(cwd, inputPaths) {
  const files = [];

  for (const inputPath of inputPaths) {
    const target = path.resolve(cwd, inputPath);
    await collectPath(target, files);
  }

  return [...new Set(files)].sort();
}

async function collectPath(target, files) {
  const info = await stat(target);
  if (info.isDirectory()) {
    const entries = await readdir(target);
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) {
        continue;
      }
      await collectPath(path.join(target, entry), files);
    }
    return;
  }

  if (!info.isFile()) {
    return;
  }
  if (path.resolve(target) === SELF) {
    return;
  }
  if (EXCLUDED_FILES.has(path.basename(target))) {
    return;
  }
  if (!CODE_EXTENSIONS.has(path.extname(target))) {
    return;
  }

  files.push(target);
}

function migrateSource(source) {
  const counters = new Map();
  let output = source;

  output = migrateImports(output, counters);
  output = replaceAll(output, counters, "GarminStick constructor", [
    /\bnew\s+GarminStick[23]\s*\(\s*\)/g,
    "await USBDriver.requestDevice()",
  ]);
  output = replaceAll(output, counters, "paired USBDriver factory", [
    /\bUSBDriver\.createFromPairedDevice\s*\(\s*\)/g,
    "await USBDriver.fromPairedDevice()",
  ]);
  output = replaceAll(output, counters, "new-device USBDriver factory", [
    /\bUSBDriver\.createFromNewDevice\s*\(\s*\)/g,
    "await USBDriver.requestDevice()",
  ]);
  output = replaceAll(output, counters, "USBDriver device wrapper", [
    /\bUSBDriver\.createFromDevice\s*\(/g,
    "USBDriver.fromDevice(",
  ]);
  output = replaceAll(output, counters, "attachSensor", [
    /(\b[\w$.]+)\.attachSensor\s*\(\s*([^,\n()]+)\s*,\s*([^)]+?)\s*\)/g,
    "$1.attach({ channel: $2, deviceId: $3 })",
  ]);
  output = replaceAll(output, counters, "setWheelCircumference", [
    /(\b[\w$.]+)\.setWheelCircumference\s*\(\s*([^)]+?)\s*\)/g,
    "$1.wheelCircumference = $2",
  ]);

  for (const [from, to] of EVENT_RENAMES) {
    output = replaceAll(output, counters, `event ${from}`, [
      new RegExp(`(["'])${escapeRegExp(from)}\\1`, "g"),
      `"${to}"`,
    ]);
  }

  for (const [from, to] of STATE_FIELD_RENAMES) {
    output = replaceAll(output, counters, `field ${from}`, [
      new RegExp(`\\.${escapeRegExp(from)}\\b`, "g"),
      `.${to}`,
    ]);
  }

  const notes = findReviewNotes(output, counters);
  return {
    changed: output !== source,
    counters,
    notes,
    output,
  };
}

function migrateImports(source, counters) {
  return source.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*(["'])(web-ant-plus)\2\s*;/g,
    (match, imports, quote, specifier) => {
      const tokens = imports
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      let removedStickImport = false;
      const kept = [];

      for (const token of tokens) {
        if (/^(type\s+)?GarminStick[23](\s+as\s+\w+)?$/.test(token)) {
          removedStickImport = true;
          continue;
        }
        kept.push(token);
      }

      if (
        removedStickImport &&
        !kept.some((token) => /\bUSBDriver\b/.test(token))
      ) {
        kept.push("USBDriver");
      }

      if (!removedStickImport) {
        return match;
      }

      increment(counters, "GarminStick import");
      const multiline = match.includes("\n") || kept.length > 4;
      if (multiline) {
        return `import {\n  ${kept.join(",\n  ")},\n} from ${quote}${specifier}${quote};`;
      }
      return `import { ${kept.join(", ")} } from ${quote}${specifier}${quote};`;
    },
  );
}

function replaceAll(source, counters, label, [pattern, replacement]) {
  let count = 0;
  const output = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === "function"
      ? replacement(...args)
      : applyReplacement(replacement, args);
  });
  if (count > 0) {
    increment(counters, label, count);
  }
  return output;
}

function applyReplacement(replacement, args) {
  return replacement.replace(/\$(\$|\d+)/g, (match, token) => {
    if (token === "$") {
      return "$";
    }
    const index = Number(token);
    return args[index] ?? match;
  });
}

function findReviewNotes(source, counters) {
  const notes = [];
  const changedLegacyApi = counters.size > 0;
  if (!changedLegacyApi) {
    return notes;
  }

  if (/\bonce\s*\(\s*["']startup["']/.test(source)) {
    notes.push(
      "Review startup handlers: driver.open() now resolves after startup, so this can usually become code after await driver.open().",
    );
  }
  if (/\bon\s*\(\s*["']startup["']/.test(source)) {
    notes.push(
      "Review startup handlers: driver.open() now resolves after startup, so this can usually become code after await driver.open().",
    );
  }
  if (
    counters.has("paired USBDriver factory") &&
    /\bawait\s+USBDriver\.fromPairedDevice\s*\(\s*\)/.test(source)
  ) {
    notes.push(
      "USBDriver.fromPairedDevice() can return undefined when no permitted ANT+ stick is available.",
    );
  }
  if (
    (counters.has("GarminStick constructor") ||
      counters.has("new-device USBDriver factory")) &&
    /\bawait\s+USBDriver\.requestDevice\s*\(\s*\)/.test(source)
  ) {
    notes.push(
      "USBDriver.requestDevice() opens the browser pairing dialog and must run from a user gesture in many browsers.",
    );
  }
  return [...new Set(notes)];
}

function printReport(cwd, results, options) {
  if (results.length === 0) {
    console.log(`No v2 API usage found for web-ant-plus ${VERSION} migration.`);
    return;
  }

  const mode = options.write ? "Updated" : "Would update";
  console.log(
    `${mode} ${results.filter((result) => result.changed).length} file(s).`,
  );

  for (const result of results) {
    const relative = path.relative(cwd, result.file);
    console.log(`\n${relative}`);
    for (const [label, count] of result.counters) {
      console.log(`  - ${label}: ${count}`);
    }
    for (const note of result.notes) {
      console.log(`  - TODO: ${note}`);
    }
  }

  if (!options.write) {
    console.log("\nDry run only. Re-run with --write to update files.");
  }
}

function increment(counters, label, count = 1) {
  counters.set(label, (counters.get(label) ?? 0) + count);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
