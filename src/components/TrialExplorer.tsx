import { useState } from 'react';
import '../styles/trial.css';

// Educational, synthetic trials. These are not telemetry, benchmark results,
// measured improvements, or output from a released vivace build. Values are a
// percentage of the baseline gait records before it applies the candidate.
type Arm = 'A' | 'B';
const PHASES = ['Intake', 'Preflight', 'Baseline', 'Apply', 'Verify', 'Review', 'Packet'];
// A and B alternate every two 100-step windows, as gait flips arms every 200 decode steps.
const alternating: Arm[] = Array.from({ length: 16 }, (_, i) => (Math.floor(i / 2) % 2 ? 'B' : 'A'));

const scenarios = [
  {
    id: 'kept', label: 'Kept', outcome: 'Kept', trialEnd: 15,
    finding: 'r08 · prefill and decode interference', change: 'prefill_chunk_tokens 512 → 1,024',
    heading: 'Faster on every B window.\nKept.',
    explanation: 'Throughput rose on each B window, and the 95% confidence interval for the gain excludes zero. p99 time per token stayed inside its 1.10 times limit.',
    next: 'gait stops the comparison and sets 1,024 for real. The trial report names the flag that keeps it after a restart:', flag: '--set prefill_chunk_tokens=1024',
    arms: alternating,
    throughput: [100, 99, 111, 113, 101, 100, 112, 111, 99, 101, 113, 112, 100, 100, 111, 112],
    latency: [100, 101, 104, 103, 99, 100, 105, 104, 101, 100, 103, 104, 100, 99, 104, 105],
    skipped: [] as string[], phaseNote: 'Review passed: the objective improved, every constraint held, and B failed no more requests than A.',
  },
  {
    id: 'guardrail', label: 'Guardrail', outcome: 'Reverted', trialEnd: 3, marker: { at: 3, label: 'guardrail trip' },
    finding: 'r12 · queue growth', change: 'max_batch_seqs 16 → 32',
    heading: 'Tail latency spiked.\nReverted in one step.',
    explanation: 'Doubling the batch raised throughput, but p99 time per token crossed 1.5 times its baseline within its first 200 steps on B.',
    next: 'The engine\'s guardrail ends the comparison on A at the next step boundary. gait records the trip; a second trip on the same setting ends the session.',
    arms: alternating.map((arm, i): Arm => (i <= 3 ? arm : 'A')),
    throughput: [100, 101, 117, 118, 101, 100, 99, 101, 100, 100, 101, 99, 100, 101, 100, 99],
    latency: [100, 99, 131, 158, 102, 100, 101, 99, 100, 101, 100, 100, 99, 100, 101, 100],
    skipped: ['Review'], phaseNote: 'Verify ended in a reject, with the guardrail trip as evidence. Packet reverts everything the trial set.',
  },
  {
    id: 'traffic', label: 'Traffic shift', outcome: 'Inconclusive', trialEnd: 15, marker: { at: 8, label: 'traffic +38%' },
    finding: 'No open finding · exploring', change: 'attn_decode_splits 4 → 8',
    heading: 'The traffic changed.\nNo verdict.',
    explanation: 'Requests per second rose 38% halfway through, past the 25% tolerance. A and B no longer saw comparable work, so the difference between them means nothing.',
    next: 'gait undoes the candidate and records the trial as inconclusive instead of guessing. Three inconclusive trials in a row end the session.',
    arms: alternating,
    throughput: [100, 102, 103, 101, 99, 101, 104, 100, 121, 125, 124, 119, 126, 122, 120, 125],
    latency: [100, 99, 101, 102, 100, 98, 101, 100, 118, 121, 117, 123, 119, 122, 124, 118],
    skipped: ['Review'], phaseNote: 'Verify abstained because the evidence was unreliable. Packet undoes the candidate.',
  },
];

const STEPS = 1600;
const xs = (step: number) => 48 + step * 590 / STEPS;
const x = (i: number) => xs((i + 0.5) * 100);
const y = (value: number) => 230 - (value - 50) * 1.4;
const points = (values: number[]) => values.map((value, i) => `${x(i)},${y(value)}`).join(' ');
const steps = (i: number) => ({ from: i * 100, to: (i + 1) * 100 });

function runs(arms: Arm[]) {
  const out: { arm: Arm; from: number; to: number }[] = [];
  arms.forEach((arm, i) => {
    const last = out.at(-1);
    if (last?.arm === arm) last.to = i;
    else out.push({ arm, from: i, to: i });
  });
  return out;
}

export default function TrialExplorer() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [sample, setSample] = useState(10);
  const scenario = scenarios[scenarioIndex];
  const arm = scenario.arms[sample];
  const range = steps(sample);
  const mean = (values: number[], side: Arm) => {
    const picked = values.filter((_, i) => i <= scenario.trialEnd && scenario.arms[i] === side);
    return picked.reduce((sum, value) => sum + value, 0) / picked.length;
  };
  const delta = (values: number[]) => {
    const change = Math.round((mean(values, 'B') / mean(values, 'A') - 1) * 100);
    return change > 0 ? `+${change}` : String(change);
  };
  const csv = ['steps_from,steps_to,arm,throughput_pct_of_baseline,p99_time_per_token_pct_of_baseline',
    ...scenario.throughput.map((value, i) => `${steps(i).from},${steps(i).to},${scenario.arms[i]},${value},${scenario.latency[i]}`)].join('\n');

  return (
    <div className="trial-explorer">
      <div className="explorer-toolbar">
        <div className="scenario-controls" role="group" aria-label="Example trial outcome">
          {scenarios.map((item, i) => <button key={item.id} aria-pressed={scenarioIndex === i} onClick={() => setScenarioIndex(i)}>{item.label}</button>)}
        </div>
        <span className="example-label">Illustrative trial · not a benchmark</span>
      </div>
      <div className="trial-display">
        <div className="trial-plots">
          <div className="plot-heading"><span>Arm B against arm A</span><span>% of baseline · per 100 decode steps</span></div>
          <div className="plot-metrics">
            <div><span className="metric-value">{delta(scenario.throughput)}<span>%</span></span><p>Throughput <span>/ B vs A</span></p></div>
            <div><span className="metric-value">{delta(scenario.latency)}<span>%</span></span><p>p99 time per token <span>/ B vs A</span></p></div>
          </div>
          <figure className="trace-figure">
            <div className="plot-legend">
              <span><i className="legend-line" />Throughput</span>
              <span><i className="legend-line dashed" />p99 time per token</span>
              <span><i className="legend-band" />Arm B</span>
              <span><i className="legend-line guardrail" />Guardrail</span>
            </div>
            <svg className="trace-chart" viewBox="0 0 680 268" role="img" aria-labelledby="trial-chart-title trial-chart-description">
              <title id="trial-chart-title">{`${scenario.label}: throughput and p99 time per token across a trial`}</title>
              <desc id="trial-chart-description">{`Both series are a percentage of the baseline, per 100 decode steps. Shaded windows ran the candidate setting. Outcome: ${scenario.outcome}. Values are in the table below the chart.`}</desc>
              {runs(scenario.arms).map(run => <g key={run.from}>
                {run.arm === 'B' && <rect className="arm-band" x={xs(run.from * 100)} y="49" width={xs((run.to + 1) * 100) - xs(run.from * 100)} height="181" />}
                <text className="arm-label" x={(xs(run.from * 100) + xs((run.to + 1) * 100)) / 2} y="42" textAnchor="middle">{run.arm}</text>
              </g>)}
              {[50, 75, 100, 125, 150, 175].map(tick => <g key={tick}><line className="chart-grid" x1="48" x2="638" y1={y(tick)} y2={y(tick)} /><text className="chart-tick" x="34" y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
              <line className="guardrail-line" x1="48" x2="638" y1={y(150)} y2={y(150)} />
              <text className="guardrail-label" x="636" y={y(150) - 6} textAnchor="end">guardrail 1.5×</text>
              {[0, 400, 800, 1200, 1600].map(step => <text className="chart-tick" key={step} x={xs(step)} y="255" textAnchor="middle">{step.toLocaleString('en-US')}</text>)}
              {scenario.marker && <g className="trial-marker">
                <line x1={x(scenario.marker.at)} x2={x(scenario.marker.at)} y1="49" y2="230" />
                <text x={x(scenario.marker.at) + 6} y="64">{scenario.marker.label}</text>
              </g>}
              <polyline className="trace-primary" points={points(scenario.throughput)} />
              <polyline className="trace-secondary" points={points(scenario.latency)} />
              <line className="sample-guide" x1={x(sample)} x2={x(sample)} y1="49" y2="230" />
              <circle className="sample-primary" cx={x(sample)} cy={y(scenario.throughput[sample])} r="4.5" />
              <circle className="sample-secondary" cx={x(sample)} cy={y(scenario.latency[sample])} r="4.5" />
            </svg>
            <div className="sample-control">
              <label htmlFor="trial-window">Inspect window</label>
              <input id="trial-window" type="range" min="0" max="15" value={sample} onChange={event => setSample(Number(event.target.value))} aria-valuetext={`Steps ${range.from} to ${range.to}, arm ${arm}: throughput ${scenario.throughput[sample]} percent, p99 time per token ${scenario.latency[sample]} percent of baseline`} />
              <output htmlFor="trial-window" className="tnum">{arm} · {range.to.toLocaleString('en-US')}</output>
            </div>
            <figcaption className="sample-readout"><span>Throughput: <b>{scenario.throughput[sample]}%</b></span><span>p99 time per token: <b>{scenario.latency[sample]}%</b></span></figcaption>
          </figure>
          <figure className="phase-figure">
            <figcaption>Trial phases <span>Outcome: <b>{scenario.outcome}</b></span></figcaption>
            <ol className="phase-track" role="list" aria-label="Trial phases">
              {PHASES.map(phase => {
                const skipped = scenario.skipped.includes(phase);
                return <li key={phase} className={skipped ? 'is-skipped' : undefined}>{phase}{skipped && <span className="sr-only"> (skipped)</span>}</li>;
              })}
            </ol>
            <p className="phase-note">{scenario.phaseNote}</p>
          </figure>
        </div>
        <aside className="trial-reading" aria-live="polite" aria-atomic="true">
          <div className="reading-label"><span className="reading-dot" aria-hidden="true" /> Reading the trial</div>
          <dl className="reading-facts">
            <div><dt>Finding</dt><dd>{scenario.finding}</dd></div>
            <div><dt>Candidate</dt><dd>{scenario.change}</dd></div>
          </dl>
          <h4>{scenario.heading.split('\n').map((line, i) => <span key={i}>{line}</span>)}</h4>
          <p>{scenario.explanation}</p>
          <div className="reading-next"><span>What gait does next</span><p>{scenario.next}</p>{scenario.flag && <code className="reading-flag">{scenario.flag}</code>}</div>
          <div className="reading-footnote"><span aria-hidden="true">↳</span> Kept only when the evidence holds.<br />Reverted when it doesn't.</div>
        </aside>
      </div>
      <div className="explorer-footer">
        <p>Synthetic examples explain how a trial reaches its verdict. Real trials depend on your model, hardware, and traffic.</p>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`strided-illustrative-trial-${scenario.id}.csv`}>Download trial <span aria-hidden="true">↓</span></a>
      </div>
      <details className="trace-data">
        <summary>View trial data</summary>
        <div className="trace-table-wrap"><table>
          <caption>{scenario.label}: illustrative values, percent of baseline, per 100 decode steps</caption>
          <thead><tr><th scope="col">Steps</th><th scope="col">Arm</th><th scope="col">Throughput (%)</th><th scope="col">p99 time per token (%)</th></tr></thead>
          <tbody>{scenario.throughput.map((value, i) => <tr key={i}><th scope="row">{steps(i).from} to {steps(i).to}</th><td>{scenario.arms[i]}</td><td>{value}</td><td>{scenario.latency[i]}</td></tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}
