import { useState } from 'react';
import '../styles/system-map.css';

const layers = [
  { id: 'workload', name: 'Workload', signal: 'Requests · sessions' },
  { id: 'scheduler', name: 'Scheduler', signal: 'Batching · prefill' },
  { id: 'cache', name: 'KV cache', signal: 'Paged · parked' },
  { id: 'kernels', name: 'Kernels', signal: 'CUDA · Metal · HIP' },
  { id: 'gpu', name: 'GPU', signal: 'RTX · Apple silicon' },
] as const;
type Layer = typeof layers[number]['id'];

// Each example is a vivace knob that gait can trial live, and the layers it reaches.
const adjustments: { label: string; layers: Layer[]; knob?: string; title: string; description: string }[] = [
  {
    label: 'Overview', layers: ['workload', 'scheduler', 'cache', 'kernels', 'gpu'],
    title: 'One process. One control loop.',
    description: 'vivace serves the model. strided reads every engine step from an in-process ring and diagnoses what limits the workload, then gait tests one setting at a time. No sidecar, no IPC, no HTTP.',
  },
  {
    label: 'Prefill', layers: ['workload', 'scheduler', 'kernels'], knob: 'prefill_chunk_tokens',
    title: 'Keep replies streaming while prompts load.',
    description: 'When long prompts stall the replies already streaming, strided flags prefill and decode interference. gait tests a new chunk size so prompt work spreads across steps.',
  },
  {
    label: 'Batching', layers: ['workload', 'scheduler', 'cache', 'gpu'], knob: 'max_batch_seqs',
    title: 'Run more sequences per step.',
    description: 'When requests queue up, or decode leaves memory bandwidth idle at a small batch, gait tests a larger batch, never past what the memory plan allows.',
  },
  {
    label: 'Attention', layers: ['cache', 'kernels', 'gpu'], knob: 'attn_decode_splits',
    title: 'Split decode attention across the GPU.',
    description: 'With no finding open, gait explores. It splits each decode attention pass into more parallel pieces and keeps the setting only if the measured result improves.',
  },
  {
    label: 'Memory', layers: ['scheduler', 'cache', 'gpu'], knob: 'kv_preempt_watermark',
    title: 'Act before the cache runs out.',
    description: 'When the KV cache nears capacity, strided flags the pressure. Resource settings like the preemption watermark change only when you allow it.',
  },
];

export default function SystemMap() {
  const [active, setActive] = useState(0);
  const adjustment = adjustments[active];
  const affected = (id: Layer) => adjustment.layers.includes(id);

  return (
    <div className="system-map">
      <div className="map-heading">
        <p className="control-heading"><span className="control-name">strided</span><span>Tunes vivace live</span></p>
        <span className="map-caption">Inside one process</span>
      </div>
      <div className="map-body">
        <svg className="stack-art" viewBox="0 0 310 377" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="etch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)"><path d="M 0 0 L 0 8" stroke="currentColor" strokeWidth=".5" opacity=".13" /></pattern>
          </defs>
          <path className="stack-axis" d="M153 7 V360" />
          {[...layers].reverse().map((layer, reversed) => {
            const y = (layers.length - 1 - reversed) * 62 + 5;
            return (
              <g key={layer.id} className={`slab${affected(layer.id) ? ' is-affected' : ''}`}>
                <path className="slab-side" d={`M35 ${y + 42} L153 ${y + 76} L271 ${y + 42} V${y + 55} L153 ${y + 89} L35 ${y + 55} Z`} />
                <path className="slab-top" d={`M35 ${y + 42} L153 ${y + 8} L271 ${y + 42} L153 ${y + 76} Z`} />
                <path fill="url(#etch)" d={`M35 ${y + 42} L153 ${y + 8} L271 ${y + 42} L153 ${y + 76} Z`} />
                <path className="slab-inlay" d={`M66 ${y + 42} L153 ${y + 17} L240 ${y + 42} L153 ${y + 67} Z`} />
                {Array.from({ length: 5 }, (_, j) => <path key={j} className="slab-slot" d={`M${53 + j * 15} ${y + 54 + j * 4.3} l8 2.3`} />)}
                <path className="slab-joint" d={`M153 ${y + 77} V${y + 88}`} />
                <path className="slab-leader" d={`M272 ${y + 43} H305`} />
                <circle className="slab-port" cx="278" cy={y + 43} r="2" />
              </g>
            );
          })}
          <g className="control-rail">
            <path className="control-spine" d="M13 0 V295" />
            {layers.map((layer, i) => (
              <g key={layer.id} className={`control-connection${affected(layer.id) ? ' is-affected' : ''}`}>
                <path d={`M13 ${i * 62 + 47} H35`} />
                <circle cx="13" cy={i * 62 + 47} r="3" />
              </g>
            ))}
          </g>
          <path className="stack-base" d="M17 321 L153 360 L289 321 M17 333 L153 372 L289 333" />
        </svg>
        <ul className="stack-labels" role="list" aria-label="The vivace stack">
          {layers.map(layer => (
            <li key={layer.id} className={`layer-label${affected(layer.id) ? ' is-affected' : ''}`}>
              <span className="layer-name">{layer.name}<span className="layer-dot" aria-hidden="true" /></span>
              <span className="layer-signal">{layer.signal}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="adjustment-controls" role="group" aria-label="Explore live adjustments">
        {adjustments.map((item, i) => (
          <button key={item.label} type="button" aria-pressed={i === active} aria-controls="control-description" onClick={() => setActive(i)}>{item.label}</button>
        ))}
      </div>
      <div className="map-detail" id="control-description" aria-live="polite" aria-atomic="true">
        <p className="map-detail-title">{adjustment.title}</p>
        <p className="map-detail-copy">{adjustment.description}</p>
        <p className="map-scope"><span>Spans </span>{layers.filter(layer => affected(layer.id)).map(layer => layer.name).join(' · ')}</p>
        <p className="map-knob">{adjustment.knob ? <><span>Setting </span><code>{adjustment.knob}</code></> : <span>Changes land between steps, without a restart</span>}</p>
      </div>
      <p className="map-footnote">Select an adjustment to see which layers it reaches.</p>
    </div>
  );
}
