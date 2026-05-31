/* GET /api/cleanup — retention job, run by Vercel Cron (see vercel.json).
   Deletes dumps older than the signed-link TTL (7 days), so we honor the
   "we don't retain raw dumps" promise and don't accumulate storage cost.

   Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the
   CRON_SECRET env var is set. We require it, so the endpoint can't be triggered
   by the public. Fails closed if CRON_SECRET is unset. */

export const prerender = false;

import type { APIRoute } from "astro";
import { json } from "../../lib/dump";
import { GET_URL_TTL } from "../../lib/storage";
import { deleteObject, listExpiredKeys } from "../../lib/storage";

const MAX_AGE_MS = GET_URL_TTL * 1000; // 7 days, matching the download-link lifetime

export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const keys = await listExpiredKeys(MAX_AGE_MS);
    const results = await Promise.allSettled(keys.map((k) => deleteObject(k)));
    const deleted = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - deleted;
    if (failed) console.error(`cleanup: ${failed} deletions failed`);
    return json({ ok: true, scanned: keys.length, deleted, failed });
  } catch (e) {
    console.error("cleanup failed", e);
    return json({ error: "Cleanup failed." }, 500);
  }
};
