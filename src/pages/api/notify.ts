/* POST /api/notify
   Body: { key, token, meta }. Verifies the token issued by /api/upload-url,
   confirms the object actually landed in the bucket within the size limit, then
   emails strided.dev@gmail.com a composed message with a 7-day signed download
   link. The raw dump is never attached or proxied through the function.
   Best-effort second email confirms receipt to the submitter; that send is not
   allowed to fail the request, since the internal lead is what matters. */

export const prerender = false;

import type { APIRoute } from "astro";
import { Resend } from "resend";
import { MAX_BYTES, json, parseMeta } from "../../lib/dump";
import { deleteObject, headSize, presignGet, verifyKey } from "../../lib/storage";

const EMAIL_TO = process.env.EMAIL_TO ?? import.meta.env.EMAIL_TO ?? "strided.dev@gmail.com";
// Until strided.dev is verified in Resend, fall back to the shared sandbox sender.
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? import.meta.env.EMAIL_FROM ?? "strided dumps <onboarding@resend.dev>";

const mb = (bytes: number) => (bytes / 1e6).toFixed(1);

export const POST: APIRoute = async ({ request }) => {
  let raw: any;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const key: unknown = raw?.key;
  const token: unknown = raw?.token;
  if (typeof key !== "string" || typeof token !== "string" || !verifyKey(key, token)) {
    return json({ error: "Invalid or expired upload token." }, 401);
  }

  const parsed = parseMeta(raw?.meta);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const meta = parsed.value;

  // Confirm the upload exists and is within bounds before announcing it.
  const size = await headSize(key);
  if (size === null) return json({ error: "Upload not found. Did the file finish uploading?" }, 409);
  if (size > MAX_BYTES) {
    await deleteObject(key).catch(() => {});
    return json({ error: "Dump exceeds the 50 MB limit." }, 413);
  }

  let downloadUrl: string;
  try {
    downloadUrl = await presignGet(key);
  } catch (e) {
    console.error("presign get failed", e);
    return json({ error: "Could not finalize the submission." }, 502);
  }

  const resend = new Resend(process.env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    replyTo: meta.email,
    subject: `Dump · ${meta.company || meta.name} · ${meta.engine}`,
    text:
      `New dump submission\n\n` +
      `Name:    ${meta.name}\n` +
      `Email:   ${meta.email}\n` +
      `Company: ${meta.company || "—"}\n` +
      `Engine:  ${meta.engine}\n` +
      `File:    ${meta.fileName} (${mb(size)} MB)\n\n` +
      `Notes:\n${meta.notes || "—"}\n\n` +
      `Download (expires in 7 days):\n${downloadUrl}\n\n` +
      `Object key: ${key}\n`,
  });

  if (error) {
    console.error("resend error", error);
    return json({ error: "Upload saved, but the notification email failed." }, 502);
  }

  // Confirm receipt to the submitter. Best-effort: a failure here is logged but
  // does not fail the request, since the lead has already been captured above.
  const firstName = meta.name.split(/\s+/)[0] || "there";
  const { error: confirmError } = await resend.emails.send({
    from: EMAIL_FROM,
    to: meta.email,
    replyTo: EMAIL_TO,
    subject: "We received your dump",
    text:
      `Hi ${firstName},\n\n` +
      `Thanks for sending your ${meta.engine} dump${meta.fileName ? ` (${meta.fileName})` : ""}. ` +
      `We'll run it through strided and get back to you here with the diagnosis.\n\n` +
      `We do not retain raw dumps after analysis.\n\n` +
      `— strided\n`,
  });
  if (confirmError) console.error("resend confirmation error", confirmError);

  return json({ ok: true });
};
