/**
 * Apple Sign In — server-side identity token verification.
 *
 * The native client (expo-apple-authentication) returns an `identityToken`
 * (a JWT signed by Apple). The server must verify it against Apple's
 * public keys before trusting the contained user info.
 *
 * Reference:
 *   https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_user
 *
 * Notes:
 *  - Apple's JWKS endpoint: https://appleid.apple.com/auth/keys
 *  - Issuer: https://appleid.apple.com
 *  - Audience: the iOS app's bundle id (and/or services id for web)
 *  - The `email` claim is only present on the first login. The `name` is
 *    NEVER in the token — Apple only sends it once via the client SDK,
 *    so the client passes it alongside the token on the very first call.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ENV } from "./env";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");

// Cached remote JWK set — jose handles key rotation and caching internally.
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(APPLE_JWKS_URL, {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    });
  }
  return cachedJwks;
}

export type AppleIdentity = {
  /** Stable Apple user id (the `sub` claim). */
  sub: string;
  /** May be undefined after the first sign-in. */
  email: string | null;
  /** True if Apple has verified the email. */
  emailVerified: boolean;
  /** True if Apple created a private relay email. */
  isPrivateEmail: boolean;
};

/**
 * Verify an Apple identity token (JWT) and return the trusted claims.
 *
 * Throws if the token is invalid, expired, or fails audience/issuer checks.
 */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  if (!identityToken || typeof identityToken !== "string") {
    throw new Error("Apple identityToken is required");
  }

  if (!ENV.appleBundleId) {
    throw new Error("APPLE_BUNDLE_ID is not configured");
  }

  const { payload } = await jwtVerify(identityToken, getJwks(), {
    issuer: APPLE_ISSUER,
    audience: ENV.appleBundleId,
  });

  return extractAppleIdentity(payload);
}

function extractAppleIdentity(payload: JWTPayload): AppleIdentity {
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("Apple identity token missing `sub` claim");
  }

  // Apple uses string "true"/"false" for these booleans in some versions.
  const toBool = (value: unknown): boolean => value === true || value === "true";

  const rawEmail = (payload as Record<string, unknown>).email;
  const email = typeof rawEmail === "string" && rawEmail.length > 0 ? rawEmail : null;

  return {
    sub,
    email,
    emailVerified: toBool((payload as Record<string, unknown>).email_verified),
    isPrivateEmail: toBool((payload as Record<string, unknown>).is_private_email),
  };
}
