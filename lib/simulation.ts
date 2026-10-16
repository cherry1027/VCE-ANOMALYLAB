export const SENSOR_KEYS = [
  "temperature",
  "oilPressure",
  "engineRpm",
  "transmissionRpm",
  "torque",
  "vibration",
] as const;

export type SensorKey = (typeof SENSOR_KEYS)[number];
export type Scenario =
  | "Normal"
  | "Pressure Drop"
  | "Overheating"
  | "Speed Mismatch"
  | "Sensor Drift"
  | "Multiple Faults";

export const SCENARIOS: Scenario[] = [
  "Normal",
  "Pressure Drop",
  "Overheating",
  "Speed Mismatch",
  "Sensor Drift",
  "Multiple Faults",
];

export const SENSOR_META: Record<
  SensorKey,
  { label: string; short: string; unit: string; color: string; decimals: number }
> = {
  temperature: { label: "Transmission temperature", short: "Temperature", unit: "°C", color: "#2dd4bf", decimals: 1 },
  oilPressure: { label: "Transmission oil pressure", short: "Oil pressure", unit: "bar", color: "#60a5fa", decimals: 1 },
  engineRpm: { label: "Engine speed", short: "Engine RPM", unit: "rpm", color: "#a78bfa", decimals: 0 },
  transmissionRpm: { label: "Transmission speed", short: "Trans. RPM", unit: "rpm", color: "#f59e0b", decimals: 0 },
  torque: { label: "Input torque", short: "Torque", unit: "Nm", color: "#fb7185", decimals: 0 },
  vibration: { label: "Housing vibration", short: "Vibration", unit: "mm/s", color: "#22d3ee", decimals: 2 },
};

export type SensorValues = Record<SensorKey, number>;

export type DataPoint = SensorValues & {
  t: number;
  time: string;
  groundTruth: boolean;
  baselineScore: number;
  iforestScore: number;
  contributions: Record<SensorKey, number>;
};

export type ScenarioData = {
  scenario: Scenario;
  points: DataPoint[];
  windows: Array<[number, number]>;
};

export type Metrics = {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  falseAlarms: number;
  delay: number | null;
};

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let x = value;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function normalNoise(random: () => number) {
  const u = Math.max(random(), 1e-9);
  const v = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hashScenario(scenario: Scenario) {
  return scenario.split("").reduce((acc, char) => acc + char.charCodeAt(0) * 17, 811);
}

function cFactor(n: number) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

type ITree =
  | { size: number }
  | { size: number; feature: SensorKey; split: number; left: ITree; right: ITree };

function buildTree(rows: SensorValues[], depth: number, maxDepth: number, random: () => number): ITree {
  if (depth >= maxDepth || rows.length <= 1) return { size: rows.length };
  const candidates = SENSOR_KEYS.filter((feature) => {
    const values = rows.map((row) => row[feature]);
    return Math.max(...values) > Math.min(...values);
  });
  if (!candidates.length) return { size: rows.length };
  const feature = candidates[Math.floor(random() * candidates.length)];
  const values = rows.map((row) => row[feature]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const split = min + random() * (max - min);
  const leftRows = rows.filter((row) => row[feature] < split);
  const rightRows = rows.filter((row) => row[feature] >= split);
  if (!leftRows.length || !rightRows.length) return { size: rows.length };
  return {
    size: rows.length,
    feature,
    split,
    left: buildTree(leftRows, depth + 1, maxDepth, random),
    right: buildTree(rightRows, depth + 1, maxDepth, random),
  };
}

function pathLength(row: SensorValues, tree: ITree, depth = 0): number {
  if (!("feature" in tree)) return depth + cFactor(tree.size);
  return row[tree.feature] < tree.split
    ? pathLength(row, tree.left, depth + 1)
    : pathLength(row, tree.right, depth + 1);
}

function isolationScores(training: SensorValues[], allRows: SensorValues[], seed: number) {
  const treeCount = 48;
  const maxDepth = Math.ceil(Math.log2(training.length));
  const random = mulberry32(seed);
  const trees = Array.from({ length: treeCount }, () => buildTree(training, 0, maxDepth, random));
  const normalizer = cFactor(training.length);
  return allRows.map((row) => {
    const averagePath = trees.reduce((sum, tree) => sum + pathLength(row, tree), 0) / treeCount;
    return Math.pow(2, -averagePath / normalizer);
  });
}

function scenarioWindows(scenario: Scenario): Array<[number, number]> {
  if (scenario === "Normal") return [];
  if (scenario === "Pressure Drop") return [[92, 126]];
  if (scenario === "Overheating") return [[88, 132]];
  if (scenario === "Speed Mismatch") return [[98, 137]];
  if (scenario === "Sensor Drift") return [[86, 148]];
  return [
    [70, 94],
    [118, 148],
  ];
}

function within(t: number, start: number, end: number) {
  return t >= start && t <= end;
}

export function generateScenario(scenario: Scenario): ScenarioData {
  const random = mulberry32(24681357 + hashScenario(scenario));
  const windows = scenarioWindows(scenario);
  const raw = Array.from({ length: 180 }, (_, t) => {
    const driveCycle = Math.sin(t / 10.7) + 0.34 * Math.sin(t / 3.9);
    const loadPulse = Math.max(0, Math.sin((t - 14) / 15));
    let temperature = 77.5 + 0.025 * t + 1.7 * Math.sin(t / 24) + normalNoise(random) * 0.32;
    let oilPressure = 23.8 + driveCycle * 0.8 + normalNoise(random) * 0.24;
    let engineRpm = 1370 + driveCycle * 245 + normalNoise(random) * 18;
    let transmissionRpm = engineRpm * (0.716 + 0.008 * Math.sin(t / 18)) + normalNoise(random) * 12;
    let torque = 690 + loadPulse * 370 + driveCycle * 75 + normalNoise(random) * 22;
    let vibration = 2.05 + Math.abs(driveCycle) * 0.35 + loadPulse * 0.2 + normalNoise(random) * 0.06;
    let groundTruth = false;

    if ((scenario === "Pressure Drop" || scenario === "Multiple Faults") && within(t, scenario === "Multiple Faults" ? 70 : 92, scenario === "Multiple Faults" ? 94 : 126)) {
      const start = scenario === "Multiple Faults" ? 70 : 92;
      groundTruth = true;
      oilPressure -= 6.5 + 0.07 * (t - start) + Math.sin(t * 1.8) * 0.6;
      vibration += 0.7 + Math.abs(Math.sin(t / 2)) * 0.35;
    }
    if ((scenario === "Overheating" || scenario === "Multiple Faults") && within(t, scenario === "Multiple Faults" ? 118 : 88, scenario === "Multiple Faults" ? 148 : 132)) {
      const start = scenario === "Multiple Faults" ? 118 : 88;
      groundTruth = true;
      temperature += 7 + (t - start) * 0.48;
      vibration += 0.45 + (t - start) * 0.018;
    }
    if ((scenario === "Speed Mismatch" || scenario === "Multiple Faults") && within(t, scenario === "Multiple Faults" ? 122 : 98, scenario === "Multiple Faults" ? 148 : 137)) {
      groundTruth = true;
      transmissionRpm -= 360 + (t % 7) * 13;
      torque += 180 + Math.sin(t / 2.5) * 55;
    }
    if (scenario === "Sensor Drift" && t >= 70) {
      const drift = (t - 70) * 0.12;
      oilPressure += drift;
      temperature += drift * 0.24;
      if (t >= 86 && t <= 148) groundTruth = true;
    }

    return {
      t,
      time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
      temperature,
      oilPressure,
      engineRpm,
      transmissionRpm,
      torque,
      vibration,
      groundTruth,
    };
  });

  const training = raw.slice(0, 60);
  const stats = Object.fromEntries(
    SENSOR_KEYS.map((key) => {
      const mean = training.reduce((sum, row) => sum + row[key], 0) / training.length;
      const variance = training.reduce((sum, row) => sum + Math.pow(row[key] - mean, 2), 0) / training.length;
      return [key, { mean, std: Math.max(Math.sqrt(variance), 0.001) }];
    }),
  ) as Record<SensorKey, { mean: number; std: number }>;

  const iScores = isolationScores(training, raw, 9901 + hashScenario(scenario));
  const points: DataPoint[] = raw.map((row, index) => {
    const squared = Object.fromEntries(
      SENSOR_KEYS.map((key) => [key, Math.pow((row[key] - stats[key].mean) / stats[key].std, 2)]),
    ) as Record<SensorKey, number>;
    const total = SENSOR_KEYS.reduce((sum, key) => sum + squared[key], 0);
    const contributions = Object.fromEntries(
      SENSOR_KEYS.map((key) => [key, total ? (squared[key] / total) * 100 : 0]),
    ) as Record<SensorKey, number>;
    return {
      ...row,
      baselineScore: Math.sqrt(total / SENSOR_KEYS.length),
      iforestScore: iScores[index],
      contributions,
    };
  });

  return { scenario, points, windows };
}

export function calculateMetrics(
  points: DataPoint[],
  scoreKey: "baselineScore" | "iforestScore",
  threshold: number,
): Metrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const point of points.slice(60)) {
    const detected = point[scoreKey] >= threshold;
    if (detected && point.groundTruth) tp += 1;
    else if (detected && !point.groundTruth) fp += 1;
    else if (!detected && point.groundTruth) fn += 1;
    else tn += 1;
  }
  const precision = tp / Math.max(tp + fp, 1);
  const recall = tp / Math.max(tp + fn, 1);
  const f1 = (2 * precision * recall) / Math.max(precision + recall, 1e-9);
  const onset = points.find((point) => point.t >= 60 && point.groundTruth)?.t;
  const detectedAt = points.find((point) => onset !== undefined && point.t >= onset && point[scoreKey] >= threshold)?.t;
  return {
    tp,
    fp,
    tn,
    fn,
    precision,
    recall,
    f1,
    falseAlarms: fp,
    delay: onset === undefined || detectedAt === undefined ? null : detectedAt - onset,
  };
}

export function topContributors(point: DataPoint, count = 3) {
  return [...SENSOR_KEYS]
    .sort((a, b) => point.contributions[b] - point.contributions[a])
    .slice(0, count)
    .map((key) => ({ key, value: point.contributions[key] }));
}
