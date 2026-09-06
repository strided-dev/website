import { useState } from 'react';
import '../styles/system-map.css';

const layers = [
  { id: 'workload', name: 'Workload', signal: 'Requests · context' },
  { id: 'model', name: 'Model', signal: 'Hyperparameters' },
  { id: 'runtime', name: 'Runtime', signal: 'Kernels · execution' },
  { id: 'memory', name: 'Memory', signal: 'Cache · layout' },
  { id: 'hardware', name: 'Hardware', signal: 'GPU · CPU · RAM' },
] as const;
type Layer = typeof layers[number]['id'];

const adjustments: { label: string; layers: Layer[]; title: string; description: string }[] = [
  {
    label: 'Overview', layers: ['workload', 'model', 'runtime', 'memory', 'hardware'],
    title: 'One control loop, across the stack.',
    description: 'strided is being built to coordinate kernel choices, hyperparameters, memory, and scheduling, then verify their combined effect on the workload.',
  },
  {
    label: 'Kernels', layers: ['model', 'runtime', 'memory', 'hardware'],
    title: 'Match execution to the model and machine.',
    description: 'Kernel choices connect model operations to execution, memory layout, and the processor. strided will tune those choices together and check the workload result.',
  },
  {
    label: 'Hyperparameters', layers: ['workload', 'model', 'runtime', 'memory'],
    title: 'Tune settings against the whole workload.',
    description: 'Model and serving hyperparameters change the work the runtime executes and the memory it needs. strided will evaluate them together, within your quality and resource limits.',
  },
  {
    label: 'Scheduling', layers: ['workload', 'runtime', 'memory', 'hardware'],
    title: 'Place work where capacity can support it.',
    description: 'Batching, concurrency, and placement connect incoming requests to execution, memory capacity, and hardware. strided will coordinate them as demand changes.',
  },
];

export default function SystemMap() {
  const [active, setActive] = useState(0);
  const adjustment = adjustments[active];
  const affected = (id: Layer) => adjustment.layers.includes(id);

  return (
    <div className="system-map">
      <div className="map-heading">
        <p className="control-heading"><span className="control-name">strided</span><span>Coordinates the stack</span></p>
        <span className="map-caption">Design direction</span>
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
        <ul className="stack-labels" role="list" aria-label="Model hosting stack">
          {layers.map(layer => (
            <li key={layer.id} className={`layer-label${affected(layer.id) ? ' is-affected' : ''}`}>
              <span className="layer-name">{layer.name}<span className="layer-dot" aria-hidden="true" /></span>
              <span className="layer-signal">{layer.signal}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="adjustment-controls" role="group" aria-label="Explore coordinated adjustments">
        {adjustments.map((item, i) => (
          <button key={item.label} type="button" aria-pressed={i === active} aria-controls="control-description" onClick={() => setActive(i)}>{item.label}</button>
        ))}
      </div>
      <div className="map-detail" id="control-description" aria-live="polite" aria-atomic="true">
        <p className="map-detail-title">{adjustment.title}</p>
        <p className="map-detail-copy">{adjustment.description}</p>
        <p className="map-scope"><span>Spans </span>{layers.filter(layer => affected(layer.id)).map(layer => layer.name).join(' · ')}</p>
      </div>
      <p className="map-footnote">Select an adjustment to see which parts work together.</p>
    </div>
  );
}
