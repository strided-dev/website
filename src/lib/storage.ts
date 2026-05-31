/* S3-compatible storage helpers for dump uploads.
   Defaults target Cloudflare R2 (set S3_ENDPOINT to the R2 endpoint); the same
   code works against AWS S3 by leaving S3_ENDPOINT unset and providing a region.

   The browser uploads the dump *directly* to the bucket via a presigned PUT URL,
   so the 50 MB payload never passes through the Vercel function (which caps
   request bodies at 4.5 MB). The server only mints URLs and reads object metadata. */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const env = (k: string): string => {
  const v = process.env[k] ?? import.meta.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
};

export const BUCKET = () => env("S3_BUCKET");
export const PUT_CONTENT_TYPE = "application/octet-stream";
export const PUT_URL_TTL = 60 * 10; // 10 min to finish the upload
export const GET_URL_TTL = 60 * 60 * 24 * 7; // 7-day download link for the team

let _client: S3Client | null = null;
const client = (): S3Client => {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.S3_REGION ?? import.meta.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT ?? import.meta.env.S3_ENDPOINT, // unset for AWS S3
    forcePathStyle: true, // required by R2 and most S3-compatible stores
    credentials: {
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
    },
  });
  return _client;
};

/** Build a collision-proof, path-traversal-safe object key for an upload. */
export const makeKey = (fileName: string): string => {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "dump";
  const now = new Date();
  const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `dumps/${ym}/${randomUUID()}-${safe}`;
};

export const presignPut = (key: string) =>
  getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: BUCKET(), Key: key, ContentType: PUT_CONTENT_TYPE }),
    { expiresIn: PUT_URL_TTL },
  );

export const presignGet = (key: string) =>
  getSignedUrl(client(), new GetObjectCommand({ Bucket: BUCKET(), Key: key }), { expiresIn: GET_URL_TTL });

/** Returns object size in bytes, or null if it does not exist. */
export const headSize = async (key: string): Promise<number | null> => {
  try {
    const r = await client().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
    return r.ContentLength ?? null;
  } catch {
    return null;
  }
};

export const deleteObject = (key: string) =>
  client().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));

/** List keys under dumps/ whose objects are older than maxAgeMs. Used by the
    retention cron to honor the "we don't keep raw dumps" promise + cap storage. */
export const listExpiredKeys = async (maxAgeMs: number): Promise<string[]> => {
  const cutoff = Date.now() - maxAgeMs;
  const expired: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const r = await client().send(
      new ListObjectsV2Command({ Bucket: BUCKET(), Prefix: "dumps/", ContinuationToken }),
    );
    for (const o of r.Contents ?? []) {
      if (o.Key && o.LastModified && o.LastModified.getTime() < cutoff) expired.push(o.Key);
    }
    ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return expired;
};

/* --- HMAC token: binds the object key the server issued to the later /notify
   call, so /notify can't be used to trigger emails for arbitrary keys. --- */
const secret = () => env("UPLOAD_TOKEN_SECRET");
export const signKey = (key: string): string => createHmac("sha256", secret()).update(key).digest("hex");
export const verifyKey = (key: string, token: string): boolean => {
  const expected = signKey(key);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
};
