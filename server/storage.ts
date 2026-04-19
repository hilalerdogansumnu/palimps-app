/**
 * File storage backed by Cloudflare R2 (S3-compatible).
 *
 * Why R2:
 *  - First 10 GB / month free
 *  - $0 egress (no bandwidth fees, ever)
 *  - Speaks the AWS S3 API, so we can use @aws-sdk/client-s3 directly
 *
 * Required env (see server/_core/env.ts):
 *   R2_ACCOUNT_ID         — Cloudflare account id
 *   R2_ACCESS_KEY_ID      — R2 token access key
 *   R2_SECRET_ACCESS_KEY  — R2 token secret key
 *   R2_BUCKET_NAME        — bucket name (default "palimps")
 *   R2_PUBLIC_BASE_URL    — public URL prefix for served objects
 *                           (e.g. https://files.palimps.app  or  https://pub-xxx.r2.dev)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.",
    );
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });

  return cachedClient;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export function buildPublicUrl(key: string): string {
  if (!ENV.r2PublicBaseUrl) {
    throw new Error(
      "R2_PUBLIC_BASE_URL is not configured. Set it to the public URL prefix of your R2 bucket " +
        "(custom domain or pub-xxx.r2.dev).",
    );
  }
  const base = ENV.r2PublicBaseUrl.replace(/\/+$/, "");
  return `${base}/${key}`;
}

/**
 * Upload a file to R2.
 *
 * Returns the storage key and a publicly accessible URL.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const client = getClient();
  const key = normalizeKey(relKey);

  const body =
    typeof data === "string"
      ? Buffer.from(data, "utf-8")
      : data instanceof Buffer
        ? data
        : Buffer.from(data);

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Enable browser caching for 1 year — these are user-uploaded immutable assets
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { key, url: buildPublicUrl(key) };
}

/**
 * Get a (public) URL for an existing object.
 *
 * If R2_PUBLIC_BASE_URL is set, returns the static public URL.
 * Otherwise falls back to a 1-hour signed URL.
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (ENV.r2PublicBaseUrl) {
    return { key, url: buildPublicUrl(key) };
  }

  const client = getClient();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: ENV.r2BucketName, Key: key }),
    { expiresIn: 3600 },
  );
  return { key, url };
}

// R2 caps presigned URL expiry at 7 days. We use the maximum so a client that
// opens an old book after a week still gets an image on first render; after
// that expo-image cache carries the bitmap indefinitely.
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7;

/**
 * Resolve a stored image reference (a legacy full public URL, or a bare R2
 * key) to a short-lived signed GET URL for display.
 *
 * Why this exists — 50316/17/18/19 all shipped with covers that uploaded
 * cleanly but failed to render on device. Root cause most likely candidates
 * are (a) R2 bucket not actually configured for public access, or (b) the
 * custom domain in R2_PUBLIC_BASE_URL not wired correctly. Signed URLs
 * short-circuit both: they work regardless of bucket public config because
 * each request carries its own AWS signature.
 *
 * Contract:
 *   - null/empty → null
 *   - stored as R2 key ("uploads/…jpg") → fresh signed URL
 *   - stored as URL under our R2_PUBLIC_BASE_URL → strip prefix, sign the key
 *   - stored as an external URL (not ours) → returned unchanged
 *   - any error → stored value returned unchanged (onError handler surfaces it)
 */
export async function toDisplayUrl(
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored) return null;
  try {
    let key: string = stored;
    if (/^https?:\/\//i.test(stored)) {
      const base = (ENV.r2PublicBaseUrl ?? "").replace(/\/+$/, "");
      if (base && stored.startsWith(base + "/")) {
        key = stored.slice(base.length + 1);
      } else {
        // External URL we didn't mint — pass through unchanged.
        return stored;
      }
    }

    const client = getClient();
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: ENV.r2BucketName, Key: normalizeKey(key) }),
      { expiresIn: SIGNED_URL_EXPIRY },
    );
  } catch (err) {
    console.error("[storage] toDisplayUrl failed for", stored, err);
    return stored;
  }
}
