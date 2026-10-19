/* POST /api/beta
   Body: JSON from the beta form, or a plain form post when JavaScript is off.
   Adds the address to Resend contacts (in RESEND_SEGMENT_ID when set) and emails
   the team. Either one keeps the signup, so the request fails only when both do.
   Form posts are redirected back to the homepage result instead of getting JSON.
   Nothing is sent to the subscriber: a public form must not email arbitrary
   addresses. The beta announcement goes out from the contacts list. */

export const prerender = false;

import type { APIRoute } from "astro";
import { Resend } from "resend";
import { json } from "../../lib/dump";
import { parseSignup } from "../../lib/beta";

const env = (k: string): string | undefined => process.env[k] ?? import.meta.env[k];
const EMAIL_TO = env("EMAIL_TO") ?? "strided.dev@gmail.com";
// Until strided.dev is verified in Resend, fall back to the shared sandbox sender.
const EMAIL_FROM = env("EMAIL_FROM") ?? "strided beta <onboarding@resend.dev>";
const FAILED = "We couldn't add you right now.";

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

  let resend: Resend;
  try {
    resend = new Resend(env("RESEND_API_KEY"));
  } catch (e) {
    console.error("resend unavailable", e);
    return reply(502, FAILED);
  }

  const segment = env("RESEND_SEGMENT_ID");
  const { error: contactError } = await resend.contacts
    .create({
      email: signup.email,
      firstName: signup.name.split(/\s+/)[0] || undefined,
      unsubscribed: false,
      ...(segment ? { segments: [{ id: segment }] } : {}),
    })
    .catch(error => ({ error }));
  if (contactError) console.error("resend contact error", contactError);

  const { error: notifyError } = await resend.emails
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
        `Added to Resend contacts: ${contactError ? `no (${contactError.message ?? "error"})` : "yes"}\n`,
    })
    .catch(error => ({ error }));
  if (notifyError) console.error("resend notify error", notifyError);

  return contactError && notifyError ? reply(502, FAILED) : reply(200);
};
