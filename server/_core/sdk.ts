/**
 * Local session manager.
 *
 * Pre-1.0 this module was a thin wrapper around the Manus OAuth aggregator.
 * After leaving Manus we authenticate users natively (Apple Sign In, Google
 * Sign In) and just need to mint and verify our own session JWTs.
 *
 * Public surface (kept stable so consumers don't have to change):
 *   sdk.signSession(payload, options)
 *   sdk.createSessionToken(openId, options)
 *   sdk.verifySession(token)
 *   sdk.authenticateRequest(req)
 *
 * The session JWT is signed with HS256 using ENV.jwtSecret. The payload is:
 *   { openId, appId, name, iat, exp }
 *
 * `openId` is namespaced per provider so Apple and Google users never collide:
 *   "apple:<sub>"  or  "google:<sub>"
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  private getSessionSecret(): Uint8Array {
    const secret = ENV.jwtSecret || ENV.cookieSecret;
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }
    return new TextEncoder().encode(secret);
  }

  private parseCookies(cookieHeader: string | undefined): Map<string, string> {
    if (!cookieHeader) return new Map();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  /**
   * Sign a session JWT for the given payload.
   */
  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  /**
   * Convenience: create a session token directly from an openId.
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name ?? "",
      },
      options,
    );
  }

  /**
   * Verify a session JWT and return its claims, or null if invalid.
   */
  async verifySession(
    token: string | undefined | null,
  ): Promise<SessionPayload | null> {
    if (!token) return null;

    try {
      const { payload } = await jwtVerify(token, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing openId");
        return null;
      }

      return {
        openId,
        appId: isNonEmptyString(appId) ? appId : ENV.appId,
        name: isNonEmptyString(name) ? name : "",
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed:", String(error));
      return null;
    }
  }

  /**
   * Authenticate an Express request via Authorization: Bearer or session cookie.
   *
   * Throws ForbiddenError on any failure. Returns the DB user record on success.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    if (!token) {
      const cookies = this.parseCookies(req.headers.cookie);
      token = cookies.get(COOKIE_NAME);
    }

    const session = await this.verifySession(token);
    if (!session) {
      throw ForbiddenError("Invalid or missing session");
    }

    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      // Native auth seeds the user row at sign-in time, so a missing row here
      // means the JWT was signed for a user that no longer exists.
      throw ForbiddenError("User not found");
    }

    // Touch lastSignedIn so we know the session is alive.
    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
    });

    return user;
  }
}

export const sdk = new SDKServer();
