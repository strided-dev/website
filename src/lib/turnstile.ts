/* Cloudflare Turnstile server-side verification.
   The browser solves the widget and sends us the resulting token; we verify it
   against Cloudflare before doing any real work (minting upload URLs / emailing).
   Fails closed: if the secret isn't configured, verification is treated as
   failed so a misconfigured deploy can't silently run without bot protection. */

const SECRET = () => process.env.TURNSTILE_SECRET_KEY ?? import.meta.env.TURNSTILE_SECRET_KEY;

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Returns true only if Cloudflare confirms the token is valid. */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = SECRET();
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set — rejecting (fail closed).");
    return false;
  }
  if (typeof token !== "string" || !token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("turnstile verify failed", e);
    return false;
  }
}
