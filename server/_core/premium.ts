import type { User } from "../../drizzle/schema";
import { ENV } from "./env";

/**
 * Tek premium truth-check.
 *
 * Öncelik sırası:
 *  1. RevenueCat webhook'un set ettiği `isPremium` flag'i (production yolu).
 *  2. PREMIUM_TEST_EMAILS allowlist (founder + QA için IAP'siz test).
 *
 * Bu helper'ı her premium gate'de kullanıyoruz — allowlist'i tek noktada
 * değiştirmek gating tutarlılığını garantiliyor. Direkt `user.isPremium === 1`
 * kontrolü yapma; allowlist devre dışı kalır.
 */
export function isUserPremium(user: Pick<User, "isPremium" | "email">): boolean {
  if (user.isPremium === 1) return true;
  if (!user.email) return false;
  if (ENV.premiumTestEmails.length === 0) return false;
  return ENV.premiumTestEmails.includes(user.email.toLowerCase());
}
