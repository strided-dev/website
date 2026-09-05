/**
 * Educational model adapted from the supplied strided-rack-cubes.html.
 * These are illustrative allocations, not telemetry or optimization results.
 * Useful work is a relative proxy, never a claim about electrical efficiency.
 */
export const GPU_LIMIT_KW = 0.71;
export const GPU_COUNT = 48;
export const CAPACITY_KW = GPU_LIMIT_KW * GPU_COUNT;

export const objectives = [
  {
    key: 'baseline', label: 'Baseline',
    title: 'Activity is only part of the picture.',
    description: 'Some GPUs draw substantial power while contributing little useful work. Looking across the rack reveals where a different allocation could matter.',
    constraint: 'Start with a reproducible baseline.',
  },
  {
    key: 'compute', label: 'Throughput',
    title: 'Put more of the rack to work.',
    description: 'This example shifts capacity toward useful work and draws slightly more power. A real throughput objective would still need to respect power and latency limits.',
    constraint: 'More work, within an explicit operating envelope.',
  },
  {
    key: 'power', label: 'Power',
    title: 'Make room within the power budget.',
    description: 'This allocation reduces draw most on GPUs doing little useful work. It releases headroom, with less total work in this example. That tradeoff needs to be deliberate.',
    constraint: 'Protect the power limit. Make the tradeoff visible.',
  },
  {
    key: 'cost', label: 'Cost',
    title: 'Make resources earn their place.',
    description: 'This example concentrates useful work while reducing draw elsewhere. A cost objective would also account for energy prices, hardware cost, and the value of completed work.',
    constraint: 'Evaluate cost per outcome, not power alone.',
  },
  {
    key: 'latency', label: 'Latency',
    title: 'Keep room for the next burst.',
    description: 'A latency objective would prioritize response-time limits and preserve spare capacity. This example makes a modest reallocation; it does not predict a latency result.',
    constraint: 'Protect response times before chasing utilization.',
  },
] as const;

export type Objective = typeof objectives[number]['key'];
type Cell = { x: number; z: number; useful: number; draw: number };
type Allocation = Pick<Cell, 'useful' | 'draw'>;

function makeRack(): Cell[] {
  let seed = 5309;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const cells: Cell[] = [];
  for (let x = 0; x < 8; x++) {
    for (let z = 0; z < 6; z++) {
      const underused = random() < 0.22;
      cells.push({
        x, z,
        useful: underused ? 0.08 + random() * 0.12 : 0.30 + random() * 0.48,
        draw: underused ? 0.62 + random() * 0.30 : 0.55 + random() * 0.42,
      });
    }
  }
  // Back to front, preserving occlusion without a 3D rendering engine.
  return cells.sort((a, b) => (a.x + a.z) - (b.x + b.z));
}

export const rack = makeRack();
const baselineWork = rack.reduce((sum, cell) => sum + cell.draw * cell.useful, 0);

export function scenario(key: Objective) {
  const allocation = rack.map(({ useful: e, draw: d }): Allocation => {
    switch (key) {
      case 'compute': return { useful: Math.min(0.94, e + (e < 0.35 ? 0.40 : 0.20)), draw: Math.min(1, d * 1.05) };
      case 'power': return { useful: Math.min(0.92, e + (e < 0.35 ? 0.32 : 0.13)), draw: d * (e < 0.5 ? 0.40 : 0.75) };
      case 'cost': return { useful: Math.min(0.90, e + 0.26), draw: d * (e < 0.40 ? 0.50 : 0.92) };
      case 'latency': return { useful: Math.min(0.80, e + 0.12), draw: Math.min(1, d * 0.97) };
      default: return { useful: e, draw: d };
    }
  });
  const draw = allocation.reduce((sum, cell) => sum + cell.draw * GPU_LIMIT_KW, 0);
  const work = allocation.reduce((sum, cell) => sum + cell.draw * cell.useful, 0);
  return { allocation, draw, workIndex: Math.round(work / baselineWork * 100), headroom: CAPACITY_KW - draw };
}

type Point = [number, number];
const project = (x: number, y: number, z: number): Point => [345 + (x - z) * 45.032, 68 + (x + z) * 26 - y];
const polygon = (points: Point[]) => 'M' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';

function faces(x0: number, x1: number, z0: number, z1: number, height: number) {
  return {
    top: polygon([project(x0, height, z0), project(x1, height, z0), project(x1, height, z1), project(x0, height, z1)]),
    right: polygon([project(x1, 0, z0), project(x1, height, z0), project(x1, height, z1), project(x1, 0, z1)]),
    left: polygon([project(x0, 0, z1), project(x0, height, z1), project(x1, height, z1), project(x1, 0, z1)]),
  };
}

export function cubePaths(cell: Cell, allocation: Allocation) {
  const x0 = cell.x + 0.2, z0 = cell.z + 0.2;
  const height = allocation.draw * 62;
  const solid = faces(x0, x0 + 0.6, z0, z0 + 0.6, height * allocation.useful);
  const wire = faces(x0, x0 + 0.6, z0, z0 + 0.6, height);
  return { wire: wire.left + wire.right + wire.top, left: solid.left, right: solid.right, top: solid.top };
}
