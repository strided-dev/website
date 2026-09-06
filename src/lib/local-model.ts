/** Illustrative local hosting allocations. These are not measured results. */
export const CAPACITY_GIB = 24;
export const BLOCK_GIB = 0.5;
export const MODEL_GIB = 8;

export const workloads = [
  {
    key: 'baseline', label: 'Baseline', cacheGiB: 6, runtimeGiB: 2, requests: 4, context: 8192,
    title: 'Start with a known configuration.',
    description: 'One resident model, a reserved KV cache, and four request slots. This is an illustrative starting point before the host responds to a change in workload.',
    constraint: 'Keep a baseline to compare each adjustment against.',
  },
  {
    key: 'chat', label: 'Chat', cacheGiB: 3, runtimeGiB: 2, requests: 2, context: 8192,
    title: 'Make room for the next reply.',
    description: 'For interactive conversations, this example reduces concurrent request slots and reserves a smaller KV cache. The aim is to keep the machine from taking on more work than it can handle.',
    constraint: 'Adjustment: fewer simultaneous requests, more memory headroom.',
  },
  {
    key: 'context', label: 'Long context', cacheGiB: 10, runtimeGiB: 2, requests: 1, context: 32768,
    title: 'Give longer prompts room.',
    description: 'This example raises the context limit and reserves more KV cache. It reduces concurrency to one request so the larger context can fit within the same memory budget.',
    constraint: 'Adjustment: a larger context allowance, fewer request slots.',
  },
  {
    key: 'batch', label: 'Batch jobs', cacheGiB: 9.5, runtimeGiB: 2.5, requests: 6, context: 4096,
    title: 'Use spare room for queued work.',
    description: 'For a queue of shorter jobs, this example allocates more request slots and runtime buffers while lowering the context limit per request.',
    constraint: 'Adjustment: more concurrent work, a shorter context allowance.',
  },
  {
    key: 'idle', label: 'Idle', cacheGiB: 0, runtimeGiB: 0.5, requests: 0, context: 8192,
    title: 'Release the cache after the work.',
    description: 'When the requests finish, this example clears the reserved KV cache and reduces runtime buffers. The model stays resident, with no request slots currently in use.',
    constraint: 'Adjustment: release temporary memory and keep the model loaded.',
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
