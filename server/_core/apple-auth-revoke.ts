/**
 * Apple Sign In server-to-server auth — token exchange + revocation.
 *
 * Two flows live here:
 *
 *   1. /api/auth/apple → exchangeAppleAuthorizationCode(code)
 *      Trades the one-shot authorizationCode (returned by the device's
 *      Apple Sign In sheet) for a long-lived refresh_token, which we
 *      persist on users.appleRefreshToken for later revocation.
 *
 *   2. deleteUserAndAllData → revokeAppleRefreshToken(token)
 *      Calls Apple's /auth/revoke at delete-account time. Required by
 *      App Store Review Guideline 5.1.1(v) since iOS 16.
 *
 * Both flows need a short-lived ES256 client_secret JWT, signed with the
 * .p8 private key downloaded from Apple Developer Portal.
 *
 * Spec references:
 *   - Token generation:
 *     https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 *   - Revoke tokens:
 *     https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
 *
 * Logging discipline (palimps-guardrails):
 *   - NEVER log refresh_token, access_token, id_token, authorizationCode
 *     contents, openId, or email.
 *   - userId (autoincrement int) and HTTP status / Apple error_code ARE safe
 *     to log — they're the operationally useful fields.
 *
 * Error policy:
 *   - This module THROWS on any failure (config missing, HTTP non-2xx,
 *     malformed response). Callers decide whether to fail hard (oauth.ts:
 *     swallow + warn so sign-in still succeeds) or fail soft (db.ts:
 *     swallow + warn so DB+R2 deletion still proceeds — KVKK Md. 7).
 */

import { SignJWT, importPKCS8 } from "jose";
import { ENV } from "./env";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const APPLE_TOKEN_ENDPOINT = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_ENDPOINT = "https://appleid.apple.com/auth/revoke";

/**
 * Apple permits up to 6 months but we keep the JWT 5-minute lived. These
 * calls are infrequent (once per sign-in + once per delete-account), the
 * cost of regenerating is negligible, and a leaked secret is bounded to a
 * 5-minute window. Defence-in-depth.
 */
const CLIENT_SECRET_LIFETIME_SECONDS = 5 * 60;

/**
 * Whether revocation flow is fully wired. Driven by env presence of the new
 * Sign In with Apple key (key id + .p8 private key). Bundle ID and Team ID
 * already have defaults so they're always present; only the new ones gate.
 */
export function isAppleRevocationConfigured(): boolean {
  return Boolean(
    ENV.appleBundleId &&
      ENV.appleTeamId &&
      ENV.appleSignInKeyId &&
      ENV.appleSignInPrivateKey,
  );
}

/**
 * Boot-time status log. Called once from server startup so a `railway logs`
 * tail confirms whether the env vars actually loaded — without this, a
 * misconfigured deployment is silent until someone tries to delete an
 * account three weeks later.
 */
export function logAppleRevocationStatus(): void {
  if (isAppleRevocationConfigured()) {
    console.log("[apple-auth] revocation: configured");
  } else {
    console.log(
      "[apple-auth] revocation: disabled (APPLE_SIGN_IN_KEY_ID or APPLE_SIGN_IN_PRIVATE_KEY missing)",
    );
  }
}

/**
 * Convert .p8 PEM string from env into a CryptoKey for ES256 signing.
 * Defensive against escaped-newline form: some env editors paste the .p8
 * contents as a single line with literal `\n` instead of real newlines.
 */
async function loadPrivateKey(): Promise<CryptoKey> {
  const raw = ENV.appleSignInPrivateKey;
  if (!raw) {
    throw new Error("APPLE_SIGN_IN_PRIVATE_KEY missing");
  }
  const pem = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  return importPKCS8(pem, "ES256") as Promise<CryptoKey>;
}

/**
 * Build the ES256 JWT used as `client_secret` in Apple's OAuth flows.
 *
 *   Header: { alg: "ES256", kid: <Key ID> }
 *   Claims: { iss: <Team ID>, iat, exp, aud: "https://appleid.apple.com",
 *             sub: <Bundle ID> }
 *
 * Exported (rather than internal) so the vitest covers it directly without
 * round-tripping through fetch mocks.
 */
export async function generateAppleClientSecret(): Promise<string> {
  if (!isAppleRevocationConfigured()) {
    throw new Error("Apple revocation not configured");
  }
  const key = await loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: ENV.appleSignInKeyId })
    .setIssuer(ENV.appleTeamId)
    .setSubject(ENV.appleBundleId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + CLIENT_SECRET_LIFETIME_SECONDS)
    .sign(key);
}

/**
 * Internal: parse an Apple OAuth error body without leaking it to logs.
 * Apple returns { error: "invalid_grant", error_description: "..." }; we
 * surface only `error` (which is a small enum of safe strings).
 */
function parseAppleErrorCode(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // ignore
  }
  return "unknown";
}

/**
 * Trade authorizationCode → refresh_token + access_token + id_token.
 * Called from /api/auth/apple AFTER identityToken is verified — never as
 * the primary auth check. Identity verification stands on its own.
 *
 * Throws on any failure. Caller is expected to swallow + log warning so
 * sign-in itself doesn't fail when revocation infra is down.
 */
export async function exchangeAppleAuthorizationCode(
  authorizationCode: string,
): Promise<{ refreshToken: string; accessToken: string; idToken: string }> {
  const clientSecret = await generateAppleClientSecret();
  const body = new URLSearchParams({
    client_id: ENV.appleBundleId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });
  const res = await fetch(APPLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const errorCode = parseAppleErrorCode(text);
    throw new Error(
      `Apple /auth/token exchange failed: ${res.status} ${errorCode}`,
    );
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
  };
  if (!json.refresh_token || !json.access_token || !json.id_token) {
    throw new Error("Apple /auth/token response missing required fields");
  }
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    idToken: json.id_token,
  };
}

/**
 * Revoke a refresh token. Per Apple's spec a successful revoke returns 200
 * with empty body and removes the app from the user's "Apps Using Apple ID"
 * list. Throws on any HTTP non-2xx — caller (deleteUserAndAllData) wraps
 * in try/catch and degrades to "best-effort skip" so the rest of the
 * deletion (R2 + DB cascade) still runs.
 */
export async function revokeAppleRefreshToken(
  refreshToken: string,
): Promise<void> {
  const clientSecret = await generateAppleClientSecret();
  const body = new URLSearchParams({
    client_id: ENV.appleBundleId,
    client_secret: clientSecret,
    token: refreshToken,
    token_type_hint: "refresh_token",
  });
  const res = await fetch(APPLE_REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const errorCode = parseAppleErrorCode(text);
    throw new Error(
      `Apple /auth/revoke failed: ${res.status} ${errorCode}`,
    );
  }
  // 200 OK with empty body = revoked. Nothing to return.
}
