/* Shared contract + validation for the dump submission flow. */

export const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with DumpForm MAX_MB
export const ENGINES = ["vllm", "sglang", "trt-llm", "other"] as const;

export type DumpMeta = {
  name: string;
  email: string;
  company: string;
  engine: string;
  notes: string;
  fileName: string;
  fileSize: number;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Coerce + validate untrusted JSON into DumpMeta. Returns an error string or the value. */
export function parseMeta(raw: unknown): { error: string } | { value: DumpMeta } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const meta: DumpMeta = {
    name: str(r.name, 200),
    email: str(r.email, 320),
    company: str(r.company, 200),
    engine: ENGINES.includes(r.engine as any) ? (r.engine as string) : "other",
    notes: str(r.notes, 4000),
    fileName: str(r.fileName, 260) || "dump",
    fileSize: typeof r.fileSize === "number" && Number.isFinite(r.fileSize) ? r.fileSize : 0,
  };
  if (!meta.name) return { error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meta.email)) return { error: "A valid email is required." };
  if (meta.fileSize <= 0) return { error: "File size is required." };
  if (meta.fileSize > MAX_BYTES) return { error: "Dump exceeds the 50 MB limit." };
  return { value: meta };
}

export const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
