/** Illustrative vivace memory use on one GPU. These are not measured results. */
export const CAPACITY_GIB = 24;
export const BLOCK_GIB = 0.5;
export const MODEL_GIB = 8;

export const workloads = [
  {
    key: 'loaded', label: 'Loaded', cacheGiB: 0, runtimeGiB: 1.5, requests: 0, context: 8192,
    title: 'Fit first, then serve.',
    description: 'At load, vivace plans memory for the weights, runtime buffers, and a pool of KV cache blocks. If a full-length conversation would not fit, it refuses cleanly instead of failing later.',
    constraint: 'Planned at load: room for at least one full-context conversation.',
  },
  {
    key: 'chat', label: 'One chat', cacheGiB: 2, runtimeGiB: 1.5, requests: 1, context: 8192,
    title: 'Keep the conversation cached.',
    description: 'Between turns, the conversation stays parked in the KV cache. The next turn reuses every matching token and prefills only the new message.',
    constraint: 'Parked between turns: only the new message is prefilled.',
  },
  {
    key: 'chats', label: 'Eight chats', cacheGiB: 9, runtimeGiB: 1.5, requests: 8, context: 8192,
    title: 'Batch conversations together.',
    description: 'Eight conversations share each decode step. Long prompts are prefilled in chunks, so replies that are already streaming keep their pace.',
    constraint: 'Tuned live: sequences per step and prefill chunk size.',
  },
  {
    key: 'agent', label: 'Agent loop', cacheGiB: 5, runtimeGiB: 1.5, requests: 1, context: 16384,
    title: 'Give long loops room.',
    description: 'An agent builds a 4,096-token prefix, then makes twenty tool calls. Each call appends its result to the cached prefix and prefills only that.',
    constraint: 'Set at load: a longer context for every sequence.',
  },
  {
    key: 'batch', label: 'Batch', cacheGiB: 11, runtimeGiB: 1.5, requests: 16, context: 8192,
    title: 'Fill the GPU with queued work.',
    description: 'Two hundred independent prompts, sixteen at a time. Nothing parks: each finished sequence frees its blocks for the next prompt in the queue.',
    constraint: 'Tuned live: more sequences per step, within the memory plan.',
  },
] as const;

export type Workload = typeof workloads[number]['key'];
type Cell = { x: number; z: number };
export const cells: Cell[] = Array.from({ length: 48 }, (_, index) => ({ x: Math.floor(index / 6), z: index % 6 }))
  .sort((a, b) => (a.x + a.z) - (b.x + b.z));

export function scenario(key: Workload) {
  const workload = workloads.find(item => item.key === key)!;
  const usedGiB = MODEL_GIB + workload.cacheGiB + workload.runtimeGiB;
  const allocation = cells.map((_, index) => Math.min(1, Math.max(0, usedGiB / BLOCK_GIB - index)));
  return { ...workload, allocation, usedGiB, headroom: CAPACITY_GIB - usedGiB };
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

// Keep the supplied graphic's isometric language. Each cube now represents
// a fixed memory block, rather than a device or a power measurement.
export function cubeSolidPaths(cell: Cell, allocation: number) {
  if (!allocation) return { left: '', right: '', top: '' };
  const x0 = cell.x + 0.2, z0 = cell.z + 0.2;
  return faces(x0, x0 + 0.6, z0, z0 + 0.6, 38 * allocation);
}

// A collapsing top face keeps its footprint even at nearly zero height.
// Fade the complete solid near the base so no opaque tile snaps away.
export function cubeOpacity(allocation: number) {
  const fraction = Math.min(1, Math.max(0, allocation / 0.25));
  return fraction * fraction * (3 - 2 * fraction);
}

export function cubePaths(cell: Cell, allocation: number) {
  const x0 = cell.x + 0.2, z0 = cell.z + 0.2;
  const wire = faces(x0, x0 + 0.6, z0, z0 + 0.6, 38);
  return {
    wire: wire.left + wire.right + wire.top,
    ...cubeSolidPaths(cell, allocation),
  };
}
