/* POST /api/beta
   Body: JSON from the beta form, or a plain form post when JavaScript is off.
   Records the signup everywhere that is configured:
   - BETA_SHEET_URL: appends a row to the team's Google Sheet (scripts/beta-sheet.gs).
   - RESEND_API_KEY: adds the address to Resend contacts (in RESEND_SEGMENT_ID when
     set) and emails the team.
   Any one of them keeps the signup, so the request fails only when all of them do.
   Form posts are redirected back to the homepage result instead of getting JSON.
   Nothing is sent to the subscriber: a public form must not email arbitrary
   addresses. The beta announcement goes out from the list. */

export const prerender = false;

import type { APIRoute } from "astro";
import { Resend } from "resend";
import { json } from "../../lib/dump";
import { appendToSheet, parseSignup } from "../../lib/beta";

const env = (k: string): string | undefined => process.env[k] ?? import.meta.env[k];
const EMAIL_TO = env("EMAIL_TO") ?? "strided.dev@gmail.com";
// Until strided.dev is verified in Resend, fall back to the shared sandbox sender.
const EMAIL_FROM = env("EMAIL_FROM") ?? "strided beta <onboarding@resend.dev>";
const FAILED = "We couldn't add you right now.";

/** Runs one destination. Returns whether it worked, logging the reason when it did not. */
const attempt = async (label: string, run: () => Promise<unknown>): Promise<boolean> => {
  try {
    await run();
    return true;
  } catch (e) {
    console.error(label, e);
    return false;
  }
};
// The Resend SDK reports failures in its result instead of throwing.
const unwrap = async ({ error }: { error: unknown }) => {
  if (error) throw error;
};
const status = (saved: boolean | undefined) => (saved === undefined ? "not configured" : saved ? "yes" : "no");

export const POST: APIRoute = async ({ request, redirect }) => {
  const isForm = !request.headers.get("content-type")?.includes("application/json");
  const reply = (status: number, error?: string) =>
    isForm ? redirect(error ? "/#beta-error" : "/#beta-joined", 303) : json(error ? { error } : { ok: true }, status);

  let raw: unknown;
  try {
    raw = isForm ? Object.fromEntries(await request.formData()) : await request.json();
  } catch {
    return reply(400, "Invalid request body.");
  }

  const parsed = parseSignup(raw);
  // Answer bots exactly like a person so the honeypot is not discoverable.
  if ("spam" in parsed) return reply(200);
  if ("error" in parsed) return reply(400, parsed.error);
  const signup = parsed.value;

  const sheetUrl = env("BETA_SHEET_URL");
  const apiKey = env("RESEND_API_KEY");
  const resend = apiKey ? new Resend(apiKey) : undefined;
  if (!sheetUrl && !resend) {
    console.error("beta signup has nowhere to go: set BETA_SHEET_URL or RESEND_API_KEY");
    return reply(502, FAILED);
  }

  const segment = env("RESEND_SEGMENT_ID");
  const [sheet, contact] = await Promise.all([
    sheetUrl ? attempt("beta sheet error", () => appendToSheet(sheetUrl, signup)) : undefined,
    resend
      ? attempt("resend contact error", () =>
          resend.contacts
            .create({
              email: signup.email,
              firstName: signup.name.split(/\s+/)[0] || undefined,
              unsubscribed: false,
              ...(segment ? { segments: [{ id: segment }] } : {}),
            })
            .then(unwrap),
        )
      : undefined,
  ]);

  const notified = resend
    ? await attempt("resend notify error", () =>
        resend.emails
          .send({
            from: EMAIL_FROM,
            to: EMAIL_TO,
            replyTo: signup.email,
            subject: `vivace beta · ${signup.name || signup.email} · ${signup.gpu}`,
            text:
              `New vivace beta signup\n\n` +
              `Email: ${signup.email}\n` +
              `Name:  ${signup.name || "Not provided"}\n` +
              `GPU:   ${signup.gpu}\n` +
              `OS:    ${signup.os}\n\n` +
              `What they would run:\n${signup.use || "Not provided"}\n\n` +
              `Saved to the sheet: ${status(sheet)}\n` +
              `Added to Resend contacts: ${status(contact)}\n`,
          })
          .then(unwrap),
      )
    : undefined;

  return sheet || contact || notified ? reply(200) : reply(502, FAILED);
};
