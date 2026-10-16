"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Download,
  FileCheck2,
  Gauge,
  GitCompareArrows,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateMetrics,
  generateScenario,
  SCENARIOS,
  SENSOR_KEYS,
  SENSOR_META,
  topContributors,
  type DataPoint,
  type Metrics,
  type Scenario,
  type SensorKey,
} from "@/lib/simulation";

const CHART_TOOLTIP = {
  background: "#111e2d",
  border: "1px solid #294056",
  borderRadius: 10,
  boxShadow: "0 12px 30px rgba(0,0,0,.25)",
  fontSize: 12,
};

const metric = (value: number) => value.toFixed(2);

function detectedEvents(points: DataPoint[], threshold: number) {
  const events: Array<{ start: number; end: number; peak: DataPoint }> = [];
  let current: { start: number; end: number; peak: DataPoint } | null = null;
  points.slice(60).forEach((point) => {
    if (point.baselineScore >= threshold) {
      if (!current || point.t > current.end + 2) {
        if (current) events.push(current);
        current = { start: point.t, end: point.t, peak: point };
      } else {
        current.end = point.t;
        if (point.baselineScore > current.peak.baselineScore) current.peak = point;
      }
    } else if (current) {
      events.push(current);
      current = null;
    }
  });
  if (current) events.push(current);
  return events.slice(0, 6);
}

function AnomalyBands({ windows }: { windows: Array<[number, number]> }) {
  return windows.map(([start, end]) => (
    <ReferenceArea key={`${start}-${end}`} x1={start} x2={end} fill="#fb7185" fillOpacity={0.12} stroke="#fb7185" strokeOpacity={0.25} />
  ));
}

function StatusPill({ children, tone = "teal" }: { children: React.ReactNode; tone?: "teal" | "amber" | "red" | "blue" }) {
  const styles = {
    teal: "border-teal-400/20 bg-teal-400/10 text-teal-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${styles[tone]}`}>{children}</span>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function SparkStat({ label, value, sub, icon: Icon, tone = "teal" }: { label: string; value: string; sub: string; icon: React.ElementType; tone?: "teal" | "amber" | "rose" | "blue" }) {
  const color = { teal: "text-teal-300 bg-teal-400/10", amber: "text-amber-300 bg-amber-400/10", rose: "text-rose-300 bg-rose-400/10", blue: "text-blue-300 bg-blue-400/10" }[tone];
  return (
    <div className="metric-card">
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${color}`}><Icon size={17} /></div>
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <div className="mt-1 flex items-end gap-2"><strong className="text-xl font-semibold tracking-tight text-slate-50">{value}</strong><span className="mb-0.5 truncate text-[11px] text-slate-500">{sub}</span></div>
      </div>
    </div>
  );
}

function SignalChart({ title, subtitle, data, windows, signals }: { title: string; subtitle: string; data: DataPoint[]; windows: Array<[number, number]>; signals: SensorKey[] }) {
  return (
    <div className="chart-box">
      <div className="mb-3 flex items-center justify-between">
        <div><h3 className="text-sm font-semibold text-slate-100">{title}</h3><p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p></div>
        <div className="flex gap-2">{signals.map((key) => <span key={key} className="h-1.5 w-6 rounded-full" style={{ backgroundColor: SENSOR_META[key].color }} />)}</div>
      </div>
      <div className="h-[188px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#26384a" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="t" type="number" domain={[0, 179]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}s`} />
            <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={55} domain={["auto", "auto"]} />
            {signals.length > 1 && <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={54} domain={["auto", "auto"]} />}
            <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={(v) => `T+${v}s`} formatter={(value, name) => [`${Number(value).toFixed(SENSOR_META[name as SensorKey]?.decimals ?? 1)} ${SENSOR_META[name as SensorKey]?.unit ?? ""}`, SENSOR_META[name as SensorKey]?.short ?? name]} />
            <AnomalyBands windows={windows} />
            {signals.map((key, index) => <Line key={key} yAxisId={index === 0 ? "left" : "right"} type="monotone" dataKey={key} stroke={SENSOR_META[key].color} strokeWidth={1.8} dot={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MonitorPage({ scenario, setScenario, threshold, setThreshold }: { scenario: Scenario; setScenario: (scenario: Scenario) => void; threshold: number; setThreshold: (value: number) => void }) {
  const scenarioData = useMemo(() => generateScenario(scenario), [scenario]);
  const [visible, setVisible] = useState(180);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setVisible((value) => {
        if (value >= 180) {
          setRunning(false);
          return 180;
        }
        return Math.min(180, value + 2);
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [running]);

  const displayed = scenarioData.points.slice(0, visible);
  const current = displayed.at(-1) ?? scenarioData.points[0];
  const events = detectedEvents(displayed, threshold);
  const metrics = calculateMetrics(scenarioData.points, "baselineScore", threshold);
  const currentContributors = topContributors(current);
  const flagged = current.t >= 60 && current.baselineScore >= threshold;

  function resetAndRun() {
    setVisible(1);
    setRunning(true);
  }

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2"><StatusPill><CircleDot size={10} fill="currentColor" /> Test cell online</StatusPill><span className="text-xs text-slate-500">Run TRX-2604-071 · 1 Hz sample rate</span></div>
          <h1>Transmission Test Monitor</h1>
          <p>Live multivariate condition monitoring for system-level drivetrain validation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="select-wrap"><span className="sr-only">Select simulated scenario</span><select value={scenario} onChange={(event) => { setScenario(event.target.value as Scenario); setVisible(180); setRunning(false); }}>{SCENARIOS.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
          <button className="btn secondary" onClick={() => { setRunning(false); setVisible(1); }}><RotateCcw size={15} /> Reset</button>
          <button className="btn primary" onClick={() => visible >= 180 ? resetAndRun() : setRunning((value) => !value)}>{running ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}{running ? "Pause run" : visible >= 180 ? "Replay test" : "Resume run"}</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SparkStat label="Test progress" value={`${Math.round((visible / 180) * 100)}%`} sub={`${current.time} / 02:59`} icon={Activity} />
        <SparkStat label="Anomaly score" value={current.baselineScore.toFixed(2)} sub={`limit ${threshold.toFixed(1)}`} icon={ScanLine} tone={flagged ? "rose" : "blue"} />
        <SparkStat label="Detected events" value={String(events.length).padStart(2, "0")} sub={`${metrics.falseAlarms} false alarms`} icon={AlertTriangle} tone={events.length ? "amber" : "teal"} />
        <SparkStat label="Sensor health" value={flagged ? "Attention" : "Nominal"} sub="6 channels linked" icon={ShieldCheck} tone={flagged ? "rose" : "teal"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Panel className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><p className="eyebrow text-teal-300">Sensor trends</p><h2 className="mt-1 text-lg font-semibold text-white">Multivariate signal explorer</h2><p className="mt-1 text-xs text-slate-500">Pink regions show seeded ground-truth fault intervals · data is simulated</p></div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400"><span className="font-mono text-teal-300">SEED 24681357</span> · deterministic</div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <SignalChart title="Thermal & hydraulic" subtitle="Temperature / oil pressure" data={displayed} windows={scenarioData.windows} signals={["temperature", "oilPressure"]} />
              <SignalChart title="Rotational speed" subtitle="Engine / transmission input" data={displayed} windows={scenarioData.windows} signals={["engineRpm", "transmissionRpm"]} />
            </div>
            <div className="mt-3"><SignalChart title="Load & vibration" subtitle="Mechanical load / housing response" data={displayed} windows={scenarioData.windows} signals={["torque", "vibration"]} /></div>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div><p className="eyebrow text-amber-300">Detection layer</p><h2 className="mt-1 text-lg font-semibold text-white">Statistical anomaly score</h2></div>
              <label className="flex min-w-[235px] items-center gap-3 text-xs text-slate-400"><span>Threshold</span><input className="accent-teal-400" type="range" min="1.5" max="4.5" step="0.1" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><strong className="w-8 text-right font-mono text-teal-300">{threshold.toFixed(1)}</strong></label>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayed} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                  <defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity={0.4} /><stop offset="1" stopColor="#2dd4bf" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="#26384a" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={[0, 179]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}s`} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} labelFormatter={(v) => `T+${v}s`} formatter={(value) => [Number(value).toFixed(2), "Baseline score"]} />
                  <AnomalyBands windows={scenarioData.windows} />
                  <ReferenceLine y={threshold} stroke="#f59e0b" strokeDasharray="7 5" label={{ value: `warn ${threshold.toFixed(1)}`, fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="baselineScore" stroke="#2dd4bf" strokeWidth={2} fill="url(#scoreFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400"><strong className="text-slate-200">Implemented baseline:</strong> each channel is standardized against the first 60 seconds, then combined as the root-mean-square of six z-scores. Signal contributions are each channel&apos;s share of squared deviation.</div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="eyebrow">Detected events</p><h2 className="mt-1 text-base font-semibold text-white">Alert evidence</h2></div><StatusPill tone={events.length ? "amber" : "teal"}>{events.length ? `${events.length} alerts` : "No alerts"}</StatusPill></div>
            <div className="overflow-x-auto"><table><thead><tr><th>Interval</th><th>Peak score</th><th>Primary contributor</th><th>Contribution mix</th><th>Status</th></tr></thead><tbody>
              {events.length ? events.map((event, index) => {
                const top = topContributors(event.peak);
                return <tr key={`${event.start}-${index}`}><td className="font-mono text-slate-300">T+{event.start}s–{event.end}s</td><td className="font-mono text-amber-300">{event.peak.baselineScore.toFixed(2)}</td><td><span className="signal-dot" style={{ background: SENSOR_META[top[0].key].color }} />{SENSOR_META[top[0].key].short}</td><td><div className="flex min-w-[180px] gap-1">{top.map((item) => <div key={item.key} title={`${SENSOR_META[item.key].short} ${item.value.toFixed(0)}%`} className="h-2 rounded-full" style={{ width: `${Math.max(item.value, 6)}%`, background: SENSOR_META[item.key].color }} />)}</div></td><td><StatusPill tone={event.peak.groundTruth ? "red" : "amber"}>{event.peak.groundTruth ? "Matched fault" : "False alarm"}</StatusPill></td></tr>;
              }) : <tr><td colSpan={5} className="py-8 text-center text-slate-500">No score excursions at the current threshold.</td></tr>}
            </tbody></table></div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel className={`overflow-hidden p-5 ${flagged ? "ring-1 ring-rose-400/30" : ""}`}>
            <div className="flex items-start justify-between"><div><p className="eyebrow">Current assessment</p><h2 className="mt-1 text-lg font-semibold text-white">{flagged ? "Abnormal behavior" : "Operating envelope"}</h2></div><div className={`score-orb ${flagged ? "danger" : ""}`}><span>{current.baselineScore.toFixed(1)}</span><small>score</small></div></div>
            <div className="mt-5 space-y-3">{currentContributors.map((item) => <div key={item.key}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{SENSOR_META[item.key].short}</span><span className="font-mono text-slate-500">{item.value.toFixed(0)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: SENSOR_META[item.key].color }} /></div></div>)}</div>
            <p className="mt-5 border-t border-slate-800 pt-4 text-xs leading-relaxed text-slate-400">{flagged ? `${SENSOR_META[currentContributors[0].key].short} is the leading source of deviation. Verify the signal against the redundant test-cell channel.` : "Signals remain inside the learned baseline envelope. Continue monitoring through the load cycle."}</p>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Sensor health</p><h2 className="mt-1 text-base font-semibold text-white">Live channels</h2></div><Activity size={18} className="text-teal-300" /></div>
            <div className="space-y-1">{SENSOR_KEYS.map((key) => {
              const contribution = current.contributions[key];
              const warn = contribution > 38 && flagged;
              return <div key={key} className="sensor-row"><span className="signal-dot" style={{ backgroundColor: SENSOR_META[key].color }} /><div className="min-w-0 flex-1"><p className="truncate text-xs text-slate-300">{SENSOR_META[key].short}</p><p className="font-mono text-[10px] text-slate-600">CH-{String(SENSOR_KEYS.indexOf(key) + 1).padStart(2, "0")}</p></div><div className="text-right"><p className="font-mono text-xs font-semibold text-slate-200">{current[key].toFixed(SENSOR_META[key].decimals)} <span className="text-[10px] font-normal text-slate-600">{SENSOR_META[key].unit}</span></p><p className={`text-[10px] ${warn ? "text-rose-300" : "text-teal-400"}`}>{warn ? "Inspect" : "Healthy"}</p></div></div>;
            })}</div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Test timeline</p><h2 className="mt-1 text-base font-semibold text-white">Drive cycle</h2></div><span className="font-mono text-xs text-slate-500">02:59</span></div>
            <div className="timeline">{[
              { at: 0, label: "System warm-up", sub: "Signal stabilization" },
              { at: 20, label: "Baseline learning", sub: "Normal envelope · 60 s" },
              { at: 60, label: "Load cycle", sub: "Dynamic torque sweep" },
              { at: scenarioData.windows[0]?.[0] ?? 120, label: scenario === "Normal" ? "Steady-state hold" : "Seeded anomaly", sub: scenario === "Normal" ? "No injected fault" : scenario },
              { at: 150, label: "Cool-down", sub: "Final validation pass" },
            ].map((item) => <div key={`${item.at}-${item.label}`} className={current.t >= item.at ? "done" : ""}><span>{current.t >= item.at ? <Check size={10} /> : null}</span><div><p>{item.label}</p><small>{item.sub}</small></div><time>T+{item.at}s</time></div>)}</div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function ConfusionMatrix({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-center text-xs">
      <div /><div className="pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pred. fault</div><div className="pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pred. normal</div>
      <div className="flex items-center pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Actual fault</div><div className="matrix-cell good"><strong>{metrics.tp}</strong><span>True positive</span></div><div className="matrix-cell bad"><strong>{metrics.fn}</strong><span>False negative</span></div>
      <div className="flex items-center pr-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Actual normal</div><div className="matrix-cell warn"><strong>{metrics.fp}</strong><span>False positive</span></div><div className="matrix-cell neutral"><strong>{metrics.tn}</strong><span>True negative</span></div>
    </div>
  );
}

function ModelCard({ name, label, metrics, color, icon: Icon }: { name: string; label: string; metrics: Metrics; color: string; icon: React.ElementType }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between"><div><span className="model-icon" style={{ color, backgroundColor: `${color}18` }}><Icon size={18} /></span><h3 className="mt-4 text-base font-semibold text-white">{name}</h3><p className="mt-1 text-xs text-slate-500">{label}</p></div><StatusPill>Actual output</StatusPill></div>
      <div className="mt-5 grid grid-cols-3 gap-2">{[["Precision", metrics.precision], ["Recall", metrics.recall], ["F1 score", metrics.f1]].map(([item, value]) => <div key={String(item)} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{String(item)}</p><p className="mt-1 font-mono text-lg font-semibold text-white">{metric(Number(value))}</p></div>)}</div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-xs"><span className="text-slate-500">False alarms <strong className="ml-1 font-mono text-slate-200">{metrics.falseAlarms}</strong></span><span className="text-slate-500">Detection delay <strong className="ml-1 font-mono text-slate-200">{metrics.delay === null ? "—" : `${metrics.delay}s`}</strong></span></div>
    </Panel>
  );
}

function EvaluationPage({ scenario, baselineThreshold, setBaselineThreshold }: { scenario: Scenario; baselineThreshold: number; setBaselineThreshold: (value: number) => void }) {
  const [forestThreshold, setForestThreshold] = useState(0.61);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({ "Pressure Drop": true, Overheating: true, "Speed Mismatch": false, "Sensor Drift": true, "Multiple Faults": false });
  const selectedData = useMemo(() => generateScenario(scenario), [scenario]);
  const baselineMetrics = calculateMetrics(selectedData.points, "baselineScore", baselineThreshold);
  const forestMetrics = calculateMetrics(selectedData.points, "iforestScore", forestThreshold);
  const comparison = useMemo(() => SCENARIOS.map((item) => {
    const data = generateScenario(item);
    return { scenario: item, baseline: calculateMetrics(data.points, "baselineScore", baselineThreshold), forest: calculateMetrics(data.points, "iforestScore", forestThreshold) };
  }), [baselineThreshold, forestThreshold]);
  const sensitivity = useMemo(() => [1.8, 2.2, 2.6, 3, 3.4, 3.8, 4.2].map((value) => ({ threshold: value, baselineF1: calculateMetrics(selectedData.points, "baselineScore", value).f1 })), [selectedData]);
  const scenarioFindings = comparison.filter((item) => item.scenario !== "Normal").map((item) => {
    const data = generateScenario(item.scenario);
    const peak = [...data.points].sort((a, b) => b.baselineScore - a.baselineScore)[0];
    const top = topContributors(peak)[0];
    return { scenario: item.scenario, at: peak.time, sensor: SENSOR_META[top.key].short, score: peak.baselineScore, reviewed: !!reviewed[item.scenario] };
  });

  function exportResults() {
    const payload = {
      title: "VCE AnomalyLab — simulated evaluation export",
      generatedFrom: "Deterministic seed 24681357",
      disclaimer: "Synthetic data only; not Volvo test measurements.",
      algorithms: { baseline: "RMS multivariate standardized deviation", isolationForest: "48-tree browser-side isolation forest" },
      thresholds: { baseline: baselineThreshold, isolationForest: forestThreshold },
      results: comparison,
      findings: scenarioFindings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "anomalylab-simulated-results.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div><div className="mb-3 flex items-center gap-2"><StatusPill tone="blue"><Sparkles size={11} /> Verification workspace</StatusPill><span className="text-xs text-slate-500">Scenario: {scenario}</span></div><h1>ML Evaluation &amp; Test Integration</h1><p>Transparent, reproducible model comparison against seeded synthetic ground truth.</p></div>
        <button onClick={exportResults} className="btn primary"><Download size={15} /> Export results</button>
      </div>

      <div className="notice"><AlertTriangle size={17} /><p><strong>Simulation boundary:</strong> all signals, faults, metrics, and findings shown here are generated for this prototype. They are not Volvo measurements. Both methods below execute locally in the browser; no AI-generated verdicts or remote model calls are used.</p></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_320px]">
        <ModelCard name="Statistical baseline" label={`6-channel z-score RMS · threshold ${baselineThreshold.toFixed(1)}`} metrics={baselineMetrics} color="#2dd4bf" icon={Activity} />
        <ModelCard name="Isolation Forest" label={`48 isolation trees · threshold ${forestThreshold.toFixed(2)}`} metrics={forestMetrics} color="#a78bfa" icon={GitCompareArrows} />
        <Panel className="p-5"><div className="mb-4"><p className="eyebrow">Confusion matrix</p><h3 className="mt-1 text-base font-semibold text-white">Isolation Forest</h3><p className="mt-1 text-xs text-slate-500">T+60s onward · {scenario}</p></div><ConfusionMatrix metrics={forestMetrics} /></Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,.75fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><div><p className="eyebrow">Scenario benchmark</p><h2 className="mt-1 text-lg font-semibold text-white">Method comparison</h2></div><div className="text-right text-xs text-slate-500">F1 score shown for each method<br /><span className="text-slate-600">same synthetic test suite</span></div></div>
          <div className="overflow-x-auto"><table><thead><tr><th>Scenario</th><th>Ground truth</th><th>Baseline F1</th><th>IF F1</th><th>Best method</th><th>Delay</th></tr></thead><tbody>{comparison.map((row) => {
            const isNormal = row.scenario === "Normal";
            const best = row.baseline.f1 >= row.forest.f1 ? "Baseline" : "Isolation Forest";
            return <tr key={row.scenario}><td className="font-medium text-slate-200">{row.scenario}</td><td><StatusPill tone={isNormal ? "teal" : "red"}>{isNormal ? "No fault" : "Seeded fault"}</StatusPill></td><td><div className="metric-bar"><span style={{ width: `${row.baseline.f1 * 100}%`, background: "#2dd4bf" }} /><b>{row.baseline.f1.toFixed(2)}</b></div></td><td><div className="metric-bar"><span style={{ width: `${row.forest.f1 * 100}%`, background: "#a78bfa" }} /><b>{row.forest.f1.toFixed(2)}</b></div></td><td className="text-slate-400">{isNormal ? "—" : best}</td><td className="font-mono text-slate-400">{isNormal ? "—" : `${Math.min(row.baseline.delay ?? 99, row.forest.delay ?? 99)}s`}</td></tr>;
          })}</tbody></table></div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-start justify-between"><div><p className="eyebrow">Sensitivity study</p><h2 className="mt-1 text-lg font-semibold text-white">Threshold tuning</h2><p className="mt-1 text-xs text-slate-500">Baseline F1 · {scenario}</p></div><SlidersHorizontal size={18} className="text-teal-300" /></div>
          <div className="mt-4 h-[170px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={sensitivity} margin={{ top: 8, left: -28, right: 0, bottom: 0 }}><CartesianGrid stroke="#26384a" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="threshold" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 1]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [Number(value).toFixed(2), "F1 score"]} /><Bar dataKey="baselineF1" radius={[4, 4, 0, 0]}>{sensitivity.map((item) => <Cell key={item.threshold} fill={Math.abs(item.threshold - baselineThreshold) < 0.21 ? "#2dd4bf" : "#25485a"} />)}</Bar></BarChart></ResponsiveContainer></div>
          <div className="space-y-4 border-t border-slate-800 pt-4"><label className="threshold-control"><span>Baseline threshold <b>{baselineThreshold.toFixed(1)}</b></span><input className="accent-teal-400" type="range" min="1.5" max="4.5" step="0.1" value={baselineThreshold} onChange={(e) => setBaselineThreshold(Number(e.target.value))} /></label><label className="threshold-control"><span>Isolation Forest threshold <b>{forestThreshold.toFixed(2)}</b></span><input className="accent-violet-400" type="range" min="0.45" max="0.75" step="0.01" value={forestThreshold} onChange={(e) => setForestThreshold(Number(e.target.value))} /></label></div>
        </Panel>
      </div>

      <Panel className="mt-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Test integration</p><h2 className="mt-1 text-lg font-semibold text-white">System-level verification workflow</h2></div><p className="max-w-xl text-xs leading-relaxed text-slate-500">Detection supports engineering judgment; it does not replace sign-off. Every alert retains sensor evidence, threshold state, and review status.</p></div>
        <div className="workflow mt-6">{[
          { icon: Waves, step: "01", title: "Sensor Data", sub: "6 synchronized channels" },
          { icon: Settings2, step: "02", title: "Preprocessing", sub: "Clean · align · standardize" },
          { icon: ScanLine, step: "03", title: "Anomaly Detection", sub: "Baseline + Isolation Forest" },
          { icon: ClipboardCheck, step: "04", title: "Engineer Review", sub: "Inspect evidence & context" },
          { icon: FileCheck2, step: "05", title: "Test Report", sub: "Traceable verified finding" },
        ].map((item, index) => <div key={item.step} className="workflow-step"><div className="flex items-center gap-3"><span className="workflow-icon"><item.icon size={18} /></span><span className="font-mono text-[10px] text-teal-400">{item.step}</span></div><h3>{item.title}</h3><p>{item.sub}</p>{index < 4 && <ArrowRight className="flow-arrow" size={17} />}</div>)}</div>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><div><p className="eyebrow">Review queue</p><h2 className="mt-1 text-lg font-semibold text-white">Engineer-reviewed findings</h2></div><span className="text-xs text-slate-500">{scenarioFindings.filter((item) => item.reviewed).length} of {scenarioFindings.length} reviewed</span></div>
        <div className="overflow-x-auto"><table><thead><tr><th>Scenario</th><th>Peak time</th><th>Leading evidence</th><th>Peak score</th><th>Reviewer decision</th></tr></thead><tbody>{scenarioFindings.map((finding) => <tr key={finding.scenario}><td className="font-medium text-slate-200">{finding.scenario}</td><td className="font-mono text-slate-400">{finding.at}</td><td>{finding.sensor}</td><td className="font-mono text-amber-300">{finding.score.toFixed(2)}</td><td><button onClick={() => setReviewed((value) => ({ ...value, [finding.scenario]: !finding.reviewed }))} className={`review-btn ${finding.reviewed ? "reviewed" : ""}`}>{finding.reviewed ? <Check size={13} /> : <CircleDot size={13} />}{finding.reviewed ? "Confirmed & reviewed" : "Awaiting review"}</button></td></tr>)}</tbody></table></div>
      </Panel>

      <Panel className="mt-4 p-5"><div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]"><div><p className="eyebrow text-teal-300">What is implemented</p><p className="mt-2 text-xs leading-relaxed text-slate-400">A deterministic six-signal simulator, z-score RMS baseline, contributor decomposition, event grouping, metrics from point-wise synthetic labels, and a real 48-tree Isolation Forest with random feature splits and path-length scoring.</p></div><div className="hidden w-px bg-slate-800 lg:block" /><div><p className="eyebrow text-amber-300">Interpretation limit</p><p className="mt-2 text-xs leading-relaxed text-slate-400">This is an interview prototype for workflow exploration. Results are simulated and are not safety evidence, production validation, or measurements from Volvo Construction Equipment.</p></div></div></Panel>
    </div>
  );
}

export default function Home() {
  const [page, setPage] = useState<"monitor" | "evaluation">("monitor");
  const [scenario, setScenario] = useState<Scenario>("Pressure Drop");
  const [threshold, setThreshold] = useState(2.7);

  return (
    <main className="min-h-screen bg-[#08111d] text-slate-300">
      <header className="app-header"><div className="header-inner">
        <button onClick={() => setPage("monitor")} className="brand" aria-label="VCE AnomalyLab home"><span className="brand-mark"><Activity size={21} /></span><span><strong>VCE</strong> AnomalyLab<small>TRANSMISSION VERIFICATION</small></span></button>
        <nav aria-label="Primary navigation"><button className={page === "monitor" ? "active" : ""} onClick={() => setPage("monitor")}><Gauge size={15} /> Test Monitor</button><button className={page === "evaluation" ? "active" : ""} onClick={() => setPage("evaluation")}><GitCompareArrows size={15} /> ML Evaluation</button></nav>
        <div className="header-meta"><span className="live-dot" /><span className="hidden sm:inline">LAB ENVIRONMENT</span><StatusPill tone="blue">Simulated</StatusPill></div>
      </div></header>

      {page === "monitor" ? <MonitorPage scenario={scenario} setScenario={setScenario} threshold={threshold} setThreshold={setThreshold} /> : <EvaluationPage scenario={scenario} baselineThreshold={threshold} setBaselineThreshold={setThreshold} />}

      <footer><span>VCE AnomalyLab</span><span>Deterministic synthetic data · seed 24681357</span><span>Prototype build 0.9.4</span></footer>
    </main>
  );
}
