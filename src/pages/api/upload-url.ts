/* POST /api/upload-url
   Body: JSON DumpMeta + a Cloudflare Turnstile token (turnstileToken). Rate-limits
   per IP, verifies the bot-check token, validates, mints an object key, and returns
   a presigned PUT URL the browser uploads the dump directly to, plus an HMAC token
   that authorizes the matching /api/notify call. The file never touches Vercel.

   This is the entry point of the whole flow (notify is gated by the HMAC token we
   issue here), so the abuse controls live here. */

export const prerender = false;

import type { APIRoute } from "astro";
import { json, parseMeta } from "../../lib/dump";
import { clientIp, rateLimit } from "../../lib/ratelimit";
import { PUT_CONTENT_TYPE, makeKey, presignPut, signKey } from "../../lib/storage";
import { verifyTurnstile } from "../../lib/turnstile";

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);
  // Tighter limit here than on notify: minting upload URLs is the abuse lever.
  const rl = rateLimit(`upload-url:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again shortly." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
    });
  }

  let raw: any;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!(await verifyTurnstile(raw?.turnstileToken, ip))) {
    return json({ error: "Bot check failed. Please reload and try again." }, 403);
  }

  const parsed = parseMeta(raw);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  const key = makeKey(parsed.value.fileName);
  try {
    const uploadUrl = await presignPut(key);
    return json({ key, uploadUrl, contentType: PUT_CONTENT_TYPE, token: signKey(key) });
  } catch (e) {
    console.error("presign failed", e);
    return json({ error: "Could not start the upload. Try again shortly." }, 502);
  }
};
