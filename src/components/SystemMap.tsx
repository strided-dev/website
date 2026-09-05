import { useState } from 'react';
import '../styles/system-map.css';

const layers = [
  { name: 'Scheduling', signal: 'Placement · queueing', title: 'The right work, in the right place.', description: 'Connect workload placement and queueing to the resources each job actually needs.' },
  { name: 'Runtimes', signal: 'Batching · cache', title: 'Make the execution path visible.', description: 'Relate batching, cache pressure, and request behavior to the latency a user experiences.' },
  { name: 'Kernels', signal: 'Compute · memory', title: 'Find the constraint behind the trace.', description: 'Separate compute, memory, and communication limits using evidence from the workload.' },
  { name: 'Hardware', signal: 'GPU · fabric · node', title: 'Read the machine as a system.', description: 'Connect node behavior, interconnect traffic, and device health to application performance.' },
  { name: 'Facility', signal: 'Power · thermals', title: 'Account for the physical limits.', description: 'Bring power budgets and thermal headroom into the same picture as the software stack.' },
];

export default function SystemMap() {
  const [active, setActive] = useState(2);
  return (
    <div className="system-map">
      <div className="map-heading"><span className="eyebrow">The strided system</span><span className="map-caption">System vision</span></div>
      <div className="map-body">
        <svg className="stack-art" viewBox="0 0 310 377" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="etch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)"><path d="M 0 0 L 0 8" stroke="currentColor" strokeWidth=".5" opacity=".13" /></pattern>
          </defs>
          <path className="stack-axis" d="M153 7 V360" />
          {[...layers].reverse().map((layer, reversed) => {
            const i = layers.length - 1 - reversed;
            const y = i * 62 + 5;
            const selected = i === active;
            return (
              <g key={layer.name} className={selected ? 'slab selected' : 'slab'}>
                <path className="slab-side" d={`M35 ${y + 42} L153 ${y + 76} L271 ${y + 42} V${y + 55} L153 ${y + 89} L35 ${y + 55} Z`} />
                <path className="slab-top" d={`M35 ${y + 42} L153 ${y + 8} L271 ${y + 42} L153 ${y + 76} Z`} />
                <path fill="url(#etch)" d={`M35 ${y + 42} L153 ${y + 8} L271 ${y + 42} L153 ${y + 76} Z`} />
                <path className="slab-inlay" d={`M66 ${y + 42} L153 ${y + 17} L240 ${y + 42} L153 ${y + 67} Z`} />
                {Array.from({ length: 5 }, (_, j) => <path key={j} className="slab-slot" d={`M${53 + j * 15} ${y + 54 + j * 4.3} l8 2.3`} />)}
                <path className="slab-joint" d={`M153 ${y + 77} V${y + 88}`} />
                <path className="slab-leader" d={`M272 ${y + 43} H305`} />
                <circle className="slab-port" cx="278" cy={y + 43} r={selected ? 3 : 2} />
                {selected && <g className="chip"><path d={`M127 ${y + 38} L153 ${y + 30} L179 ${y + 38} L153 ${y + 46} Z`} /><path d={`M127 ${y + 38} v7 l26 8 26 -8 v-7 M153 ${y + 46} v7`} /></g>}
              </g>
            );
          })}
          <path className="stack-base" d="M17 321 L153 360 L289 321 M17 333 L153 372 L289 333" />
        </svg>
        <div className="layer-controls" role="group" aria-label="Explore system layers">
          {layers.map((layer, i) => (
            <button key={layer.name} className={`layer-button ${i === active ? 'is-active' : ''}`} aria-label={`${layer.name}: ${layer.signal}`} aria-pressed={i === active} aria-controls="layer-description" onClick={() => setActive(i)}>
              <span className="layer-name">{layer.name}<span className="layer-dot" aria-hidden="true" /></span>
              <span className="layer-signal">{layer.signal}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="map-detail" id="layer-description" aria-live="polite" aria-atomic="true">
        <div><p className="map-detail-title">{layers[active].title}</p><p className="map-detail-copy">{layers[active].description}</p></div>
      </div>
      <p className="map-footnote">Select a layer to explore.</p>
    </div>
  );
}
