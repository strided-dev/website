/* Shared contract + validation for the vivace beta list. */

import { isEmail, str } from "./dump";

export const GPUS = { nvidia: "NVIDIA GeForce RTX", apple: "Apple silicon", amd: "AMD Radeon", other: "Other or not sure" } as const;
export const SYSTEMS = { windows: "Windows", macos: "macOS", linux: "Linux" } as const;

export type BetaSignup = { email: string; name: string; gpu: string; os: string; use: string };

const label = <T extends Record<string, string>>(options: T, v: unknown) =>
  typeof v === "string" && Object.hasOwn(options, v) ? options[v as keyof T] : "Not specified";

/** Coerce + validate an untrusted signup. `website` is a honeypot only bots fill in. */
export function parseSignup(raw: unknown): { spam: true } | { error: string } | { value: BetaSignup } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (str(r.website, 200)) return { spam: true };
  const signup: BetaSignup = {
    email: str(r.email, 320),
    name: str(r.name, 200),
    gpu: label(GPUS, r.gpu),
    os: label(SYSTEMS, r.os),
    use: str(r.use, 2000),
  };
  if (!isEmail(signup.email)) return { error: "A valid email is required." };
  return { value: signup };
}
