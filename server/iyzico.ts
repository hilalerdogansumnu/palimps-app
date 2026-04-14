/**
 * iyzico subscription handler — REMOVED.
 *
 * iyzico (a Turkish payment gateway) was used for in-app premium subscriptions
 * before App Store submission. Apple App Review Guideline 3.1.1 prohibits any
 * non-Apple payment system for digital subscriptions sold inside the iOS app,
 * which made the original implementation a hard rejection trigger.
 *
 * Premium subscriptions are now sold through Apple In-App Purchase, with
 * RevenueCat as the receipt validation + webhook layer. See:
 *   - server/_core/revenuecat.ts   (server-side webhook)
 *   - app/premium.tsx               (client-side paywall)
 *
 * This file is kept as a stub so any stale import surfaces a clear error
 * instead of silently importing iyzipay (which is no longer in package.json).
 */

export function iyzicoRemoved(): never {
  throw new Error(
    "iyzico has been removed. Premium subscriptions now go through Apple IAP + RevenueCat. " +
      "See server/_core/revenuecat.ts.",
  );
}
