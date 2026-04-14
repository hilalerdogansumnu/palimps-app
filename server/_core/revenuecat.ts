/**
 * RevenueCat webhook handler.
 *
 * RevenueCat is the source of truth for subscription state. After Apple's IAP
 * receipt is processed, RevenueCat fires a webhook to this endpoint with the
 * event details. We use it to flip the user's `isPremium` flag.
 *
 * Authentication:
 *   RevenueCat lets you configure a static `Authorization: Bearer <secret>`
 *   header on each webhook in the dashboard. Set REVENUECAT_WEBHOOK_SECRET
 *   to the same value here and we will reject any request whose header
 *   doesn't match.
 *
 * app_user_id convention:
 *   The client must configure RevenueCat with the user's `openId` (e.g.
 *   "apple:000123.abc..." or "google:11223344..."). That way the webhook
 *   can look up the user without needing extra mapping tables.
 *
 * Reference:
 *   https://www.revenuecat.com/docs/integrations/webhooks
 */

import type { Express, Request, Response } from "express";
import * as db from "../db";
import { ENV } from "./env";

type RevenueCatEvent = {
  type?: string;
  event_type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  purchased_at_ms?: number;
};

type RevenueCatBody = {
  event?: RevenueCatEvent;
  api_version?: string;
};

const ACTIVATING_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "TRANSFER",
]);

const DEACTIVATING_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIPTION_PAUSED",
]);

function isAuthorized(req: Request): boolean {
  const expected = ENV.revenuecatWebhookSecret;
  if (!expected) {
    console.warn("[RevenueCat] REVENUECAT_WEBHOOK_SECRET not set — rejecting webhook");
    return false;
  }
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== "string") return false;
  // Accept either "Bearer <secret>" or just the bare secret.
  const value = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  return value === expected;
}

export function registerRevenueCatRoutes(app: Express) {
  app.post("/api/webhooks/revenuecat", async (req: Request, res: Response) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    try {
      const body = (req.body ?? {}) as RevenueCatBody;
      const event = body.event;
      if (!event) {
        res.status(400).json({ error: "missing event" });
        return;
      }

      const eventType = (event.type || event.event_type || "").toUpperCase();
      const openId = event.app_user_id || event.original_app_user_id;
      if (!openId) {
        console.warn("[RevenueCat] event without app_user_id, ignoring", eventType);
        res.json({ ok: true });
        return;
      }

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        console.warn("[RevenueCat] no user matches openId", openId);
        // Acknowledge so RevenueCat stops retrying — the user may have been deleted.
        res.json({ ok: true });
        return;
      }

      if (ACTIVATING_EVENTS.has(eventType)) {
        await db.updateUserPremiumStatus(user.id, true);
        console.log(`[RevenueCat] user ${user.id} (${openId}) -> premium ON (${eventType})`);
      } else if (DEACTIVATING_EVENTS.has(eventType)) {
        await db.updateUserPremiumStatus(user.id, false);
        console.log(`[RevenueCat] user ${user.id} (${openId}) -> premium OFF (${eventType})`);
      } else {
        console.log(`[RevenueCat] ignored event type ${eventType} for user ${user.id}`);
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[RevenueCat] webhook error:", error);
      res.status(500).json({ error: "webhook processing failed" });
    }
  });
}
