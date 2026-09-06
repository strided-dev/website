import { useState } from 'react';
import '../styles/evidence.css';

// Educational, synthetic traces. These are not telemetry, benchmark results,
// measured improvements, or output from a released local model host.
const scenarios = [
  {
    id: 'context', label: 'Longer prompts', rule: 'Context pressure',
    heading: 'Longer prompts.\nMore memory in use.',
    explanation: 'In this example, GPU memory use rises as a request fills more of its configured context window. A growing KV cache leaves less room for other requests.',
    next: 'strided would reserve more cache within the memory budget and reduce concurrent request slots when needed. The configured context boundaries remain explicit.',
    primaryLabel: 'GPU memory used', secondaryLabel: 'Context budget used',
    primary: [48, 50, 54, 58, 62, 67, 71, 76, 80, 83, 85, 86],
    secondary: [12, 18, 25, 32, 40, 48, 55, 63, 70, 78, 84, 88],
    annotation: 'Memory use rises as the request fills its context window',
    segments: [44, 44, 12],
  },
  {
    id: 'requests', label: 'More requests', rule: 'Request pressure',
    heading: 'More requests.\nLess memory headroom.',
    explanation: 'Here, memory use grows as more of the host\'s request slots are occupied. Taking on more simultaneous work can leave too little room for each request.',
    next: 'strided would adjust batching and cap concurrency within the memory budget, queuing additional work until capacity is available.',
    primaryLabel: 'GPU memory used', secondaryLabel: 'Request slots used',
    primary: [54, 57, 62, 66, 72, 78, 83, 87, 84, 80, 75, 71],
    secondary: [25, 25, 50, 50, 75, 100, 100, 100, 75, 75, 50, 50],
    annotation: 'Memory use grows as available request slots fill',
    segments: [40, 46, 14],
  },
];

const x = (i: number) => 48 + i * (590 / 11);
const y = (value: number) => 230 - value * 1.75;
const points = (values: number[]) => values.map((value, i) => `${x(i)},${y(value)}`).join(' ');
const segmentNames = ['Model weights', 'KV cache', 'Runtime buffers'];

export default function EvidenceExplorer() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [sample, setSample] = useState(8);
  const scenario = scenarios[scenarioIndex];
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const csv = ['time_s,' + scenario.primaryLabel + ',' + scenario.secondaryLabel, ...scenario.primary.map((value, i) => `${i * 5},${value},${scenario.secondary[i]}`)].join('\n');

  return (
    <div className="evidence-explorer">
      <div className="explorer-toolbar">
        <div className="scenario-controls" role="group" aria-label="Example workload">
          {scenarios.map((item, i) => <button key={item.id} aria-pressed={scenarioIndex === i} onClick={() => setScenarioIndex(i)}>{item.label}</button>)}
        </div>
        <span className="example-label">Illustrative trace · not a benchmark</span>
      </div>
      <div className="evidence-display">
        <div className="evidence-plots">
          <div className="plot-heading"><span>Time-aligned signals</span><span>Sampled every 5 seconds</span></div>
          <div className="plot-metrics">
            <div><span className="metric-value">{average(scenario.primary)}<span>%</span></span><p>{scenario.primaryLabel} <span>/ mean</span></p></div>
            <div><span className="metric-value">{average(scenario.secondary)}<span>%</span></span><p>{scenario.secondaryLabel} <span>/ mean</span></p></div>
          </div>
          <figure className="trace-figure">
            <div className="plot-legend"><span><i className="legend-line" />{scenario.primaryLabel}</span><span><i className="legend-line dashed" />{scenario.secondaryLabel}</span></div>
            <svg className="trace-chart" viewBox="0 0 680 268" role="img" aria-labelledby="trace-title trace-description">
              <title id="trace-title">{`${scenario.label}: two signals over time`}</title>
              <desc id="trace-description">{scenario.annotation}. Both series are percentages. Sample values are available in the table below the chart.</desc>
              {[0, 25, 50, 75, 100].map(tick => <g key={tick}><line className="chart-grid" x1="48" x2="638" y1={y(tick)} y2={y(tick)} /><text className="chart-tick" x="34" y={y(tick) + 4} textAnchor="end">{tick}</text></g>)}
              <text className="chart-unit" x="48" y="28">percent</text>
              {[0, 2, 4, 6, 8, 10, 11].map(i => <text className="chart-tick" key={i} x={x(i)} y="255" textAnchor="middle">{i * 5}s</text>)}
              <polyline className="trace-primary" points={points(scenario.primary)} />
              <polyline className="trace-secondary" points={points(scenario.secondary)} />
              <line className="sample-guide" x1={x(sample)} x2={x(sample)} y1="49" y2="230" />
              <circle className="sample-primary" cx={x(sample)} cy={y(scenario.primary[sample])} r="4.5" />
              <circle className="sample-secondary" cx={x(sample)} cy={y(scenario.secondary[sample])} r="4.5" />
            </svg>
            <div className="sample-control">
              <label htmlFor="trace-sample">Inspect time</label>
              <input id="trace-sample" type="range" min="0" max="11" value={sample} onChange={event => setSample(Number(event.target.value))} aria-valuetext={`${sample * 5} seconds: ${scenario.primaryLabel} ${scenario.primary[sample]} percent, ${scenario.secondaryLabel} ${scenario.secondary[sample]} percent`} />
              <output htmlFor="trace-sample" className="tnum">{String(sample * 5).padStart(2, '0')} s</output>
            </div>
            <figcaption className="sample-readout"><span>{scenario.primaryLabel}: <b>{scenario.primary[sample]}%</b></span><span>{scenario.secondaryLabel}: <b>{scenario.secondary[sample]}%</b></span></figcaption>
          </figure>
          <figure className="step-figure">
            <figcaption>Where allocated memory goes <span>Illustrative share by purpose</span></figcaption>
            <div className="step-bar" role="img" aria-label={scenario.segments.map((value, i) => `${segmentNames[i]} ${value} percent`).join(', ')}>
              {scenario.segments.map((value, i) => <div key={i} className={`step-segment segment-${i}`} style={{ width: `${value}%` }}><span>{value}%</span></div>)}
            </div>
            <div className="step-legend">{segmentNames.map((name, i) => <span key={name}><i className={`segment-${i}`} />{name}</span>)}</div>
          </figure>
        </div>
        <aside className="evidence-reading" aria-live="polite" aria-atomic="true">
          <div className="reading-label"><span className="reading-dot" aria-hidden="true" /> Reading the evidence</div>
          <div className="reading-rule">{scenario.rule}</div>
          <h3>{scenario.heading.split('\n').map((line, i) => <span key={i}>{line}</span>)}</h3>
          <p>{scenario.explanation}</p>
          <div className="reading-next"><span>How the host could respond</span><p>{scenario.next}</p></div>
          <div className="reading-footnote"><span aria-hidden="true">↳</span> The workload changes.<br />The settings should follow.</div>
        </aside>
      </div>
      <div className="explorer-footer">
        <p>Synthetic examples explain the approach. Actual settings depend on your model, hardware, and workload.</p>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`strided-illustrative-${scenario.id}.csv`}>Download trace <span aria-hidden="true">↓</span></a>
      </div>
      <details className="trace-data">
        <summary>View sample data</summary>
        <div className="trace-table-wrap"><table>
          <caption>{scenario.label}: illustrative values, sampled every 5 seconds</caption>
          <thead><tr><th scope="col">Time (s)</th><th scope="col">{scenario.primaryLabel} (%)</th><th scope="col">{scenario.secondaryLabel} (%)</th></tr></thead>
          <tbody>{scenario.primary.map((value, i) => <tr key={i}><th scope="row">{i * 5}</th><td>{value}</td><td>{scenario.secondary[i]}</td></tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}
