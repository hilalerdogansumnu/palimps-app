/**
 * RevenueCat (react-native-purchases) bootstrap helpers.
 *
 * Call `initPurchases()` once at app startup. Once a user signs in, call
 * `identifyPurchasesUser(user.openId)` so the RevenueCat backend ties the
 * Apple receipt to our internal user. The webhook (server/_core/revenuecat.ts)
 * uses this same `app_user_id` to flip the DB premium flag.
 */

import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

let initialized = false;

export function initPurchases(): void {
  if (initialized) return;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

  if (!apiKey) {
    console.warn("[Purchases] No RevenueCat API key configured for", Platform.OS);
    return;
  }

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    initialized = true;
    console.log("[Purchases] configured");
  } catch (err) {
    console.error("[Purchases] failed to configure:", err);
  }
}

export async function identifyPurchasesUser(openId: string | null | undefined) {
  if (!initialized) return;
  if (!openId) return;
  try {
    await Purchases.logIn(openId);
  } catch (err) {
    console.warn("[Purchases] logIn failed:", err);
  }
}

export async function resetPurchasesUser() {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.warn("[Purchases] logOut failed:", err);
  }
}
