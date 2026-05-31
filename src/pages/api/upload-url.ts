/* POST /api/upload-url
   Body: JSON DumpMeta (no file). Validates, mints an object key, and returns a
   presigned PUT URL the browser uploads the dump directly to, plus an HMAC token
   that authorizes the matching /api/notify call. The file never touches Vercel. */

export const prerender = false;

import type { APIRoute } from "astro";
import { json, parseMeta } from "../../lib/dump";
import { PUT_CONTENT_TYPE, makeKey, presignPut, signKey } from "../../lib/storage";

export const POST: APIRoute = async ({ request }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
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
