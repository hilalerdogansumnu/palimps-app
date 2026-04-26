/**
 * Native authentication routes — Apple Sign In only.
 *
 * The mobile client performs the Apple Sign In flow natively (with the
 * system Apple Sign In sheet) and POSTs the resulting identity token to
 * /api/auth/apple. The server verifies the token against Apple's JWKS,
 * upserts the user, and mints a session JWT (cookie + bearer).
 *
 * If the client also includes `authorizationCode` (one-shot, Apple-issued
 * on every sign-in), the server fires off a background exchange against
 * Apple's /auth/token endpoint and persists the resulting refresh_token
 * on `users.appleRefreshToken`. The token is later used at delete-account
 * time to call /auth/revoke (App Store 5.1.1(v) since iOS 16). The
 * exchange is fire-and-forget so it does NOT delay sign-in response —
 * if it fails, the user falls back to legacy-skip path at delete time
 * (acceptable per palimps-guardrails ruling).
 *
 * Endpoints:
 *   POST /api/auth/apple   { identityToken, fullName?, email?, nonce?, authorizationCode? }
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *   POST /api/auth/session         (Bearer → cookie bridge for web preview)
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, updateUser, upsertUser } from "../db";
import { verifyAppleIdentityToken } from "./appleAuth";
import {
  exchangeAppleAuthorizationCode,
  isAppleRevocationConfigured,
} from "./apple-auth-revoke";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

type SyncedUser = Awaited<ReturnType<typeof getUserByOpenId>>;

async function syncUser(args: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod: "apple";
}): Promise<SyncedUser> {
  const lastSignedIn = new Date();
  await upsertUser({
    openId: args.openId,
    name: args.name ?? null,
    email: args.email ?? null,
    loginMethod: args.loginMethod,
    lastSignedIn,
  });
  return getUserByOpenId(args.openId);
}

function buildUserResponse(user: SyncedUser) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Build a display name from `{ givenName, familyName }` or a flat string.
 * Apple only sends the name on the FIRST sign-in, via the client SDK
 * (it's not in the JWT), so the client posts it alongside the token.
 */
function readFullName(input: unknown): string | null {
  if (typeof input === "string") return readString(input);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const given = readString(obj.givenName);
    const family = readString(obj.familyName);
    const joined = [given, family].filter(Boolean).join(" ").trim();
    return joined.length > 0 ? joined : null;
  }
  return null;
}

async function issueSession(
  res: Response,
  req: Request,
  user: SyncedUser,
  openId: string,
  displayName: string,
) {
  const sessionToken = await sdk.signSession(
    {
      openId,
      appId: process.env.APP_ID ?? "palimps",
      name: displayName,
    },
    { expiresInMs: ONE_YEAR_MS },
  );

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

  return {
    sessionToken,
    user: buildUserResponse(user),
  };
}

export function registerOAuthRoutes(app: Express) {
  // ────────────────────────────────────────────────────────────────────────
  // Apple Sign In
  // ────────────────────────────────────────────────────────────────────────
  app.post("/api/auth/apple", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const identityToken = readString(body.identityToken);
      if (!identityToken) {
        res.status(400).json({ error: "identityToken is required" });
        return;
      }

      const claims = await verifyAppleIdentityToken(identityToken);

      // Apple only ships the user's name on the FIRST sign-in via the client
      // SDK. The token never contains it. So the client must pass the name
      // alongside the token, and we only persist it if we don't already have
      // one stored.
      const clientName = readFullName(body.fullName);
      const clientEmail = readString(body.email);

      const openId = `apple:${claims.sub}`;
      const existing = await getUserByOpenId(openId);

      const finalName = existing?.name || clientName || null;
      const finalEmail = existing?.email || claims.email || clientEmail || null;

      const user = await syncUser({
        openId,
        name: finalName,
        email: finalEmail,
        loginMethod: "apple",
      });

      // Apple revocation infra: if the client included an authorizationCode
      // and the server has the Sign In with Apple key configured, exchange
      // it for a refresh_token in the background and persist it on the user
      // row. Used later at delete-account time for /auth/revoke (App Store
      // 5.1.1(v)). Fire-and-forget so sign-in response stays under the p95
      // budget (Apple /auth/token round-trip is ~300-800ms). On failure we
      // log a warning — user falls back to legacy-skip path at delete-time
      // (palimps-guardrails ruling: acceptable, KVKK Md. 7 is satisfied
      // by DB+R2 deletion regardless of Apple OAuth linkage).
      //
      // Logging discipline: never log authorizationCode, refresh token, or
      // openId/email. Internal userId (autoincrement int) is safe.
      const authorizationCode = readString(body.authorizationCode);
      if (authorizationCode && user?.id && isAppleRevocationConfigured()) {
        const userId = user.id;
        setImmediate(async () => {
          try {
            const { refreshToken } =
              await exchangeAppleAuthorizationCode(authorizationCode);
            await updateUser(userId, { appleRefreshToken: refreshToken });
            console.log("[apple-auth] refresh token persisted", { userId });
          } catch (err) {
            // TODO(observability): swap for Sentry.captureMessage("warning")
            // once palimps-observability-engineer wires server-side Sentry.
            console.warn("[apple-auth] authorizationCode exchange failed", {
              userId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
      }

      const result = await issueSession(res, req, user, openId, finalName ?? "");
      res.json(result);
    } catch (error) {
      console.error("[Auth/Apple] verification failed:", error);
      res.status(401).json({ error: "Apple sign-in verification failed" });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Session lifecycle
  // ────────────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.warn("[Auth] /api/auth/me failed:", String(error));
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Bearer → cookie bridge. The web preview gets the token via postMessage
  // and calls this endpoint so the backend domain receives a Set-Cookie.
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.warn("[Auth] /api/auth/session failed:", String(error));
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
