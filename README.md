# VCE AnomalyLab

A premium transmission anomaly detection and AI verification prototype inspired by Volvo Construction Equipment’s research into machine learning for abnormal-behaviour detection during system-level testing.

🔗 **Live Demo:** https://vce-anomalylab.charanvaranasi44.workers.dev

## Features

### Transmission Test Monitor

- Deterministic synthetic multivariate sensor data
- Temperature, oil pressure, engine RPM, transmission RPM, torque, and vibration
- Six selectable scenarios:
  - Normal
  - Pressure Drop
  - Overheating
  - Speed Mismatch
  - Sensor Drift
  - Multiple Faults
- Replay, pause, resume, and reset controls
- Interactive sensor charts with ground-truth anomaly intervals
- Adjustable warning threshold
- Detected-event timeline and sensor-health monitoring
- Per-alert signal contribution analysis

### ML Evaluation & Test Integration

- Statistical anomaly baseline using standardized deviations
- Browser-side 48-tree Isolation Forest with path-length scoring
- Precision, recall, F1, false alarms, and detection delay
- Confusion matrix calculated from synthetic ground truth
- Scenario and threshold sensitivity comparison
- Engineer review workflow
- Exportable JSON evaluation report
- System integration flow:
  - Sensor Data
  - Preprocessing
  - Anomaly Detection
  - Engineer Review
  - Test Report

## Algorithms

### Statistical Baseline

The first 60 seconds establish the normal operating envelope. Each sensor is standardized using its training mean and standard deviation.

The combined anomaly score is the root-mean-square of the six sensor z-scores. Signal contributions are calculated from each channel’s share of the total squared deviation.

### Isolation Forest

The application implements a lightweight Isolation Forest locally in the browser:

- 48 randomized isolation trees
- Random feature and split selection
- Path-length-based anomaly scoring
- Deterministic seeded training and evaluation

No remote AI service or pre-generated model verdict is used.

## Technology

- React
- TypeScript
- Tailwind CSS
- Lucide Icons
- Recharts
- Vinext/Vite
- Cloudflare Workers
- Wrangler

## Run Locally

```bash
npm install
npm run dev
