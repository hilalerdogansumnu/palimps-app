import { useCallback, useEffect, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { useAuth } from "./use-auth";
import { trpc } from "@/lib/trpc";

const ENTITLEMENT_ID = "premium";

/**
 * Hook to check whether the current user has an active premium subscription.
 *
 * Sources of truth, merged via OR:
 *   1. RevenueCat CustomerInfo (production IAP signal)
 *   2. Server `subscriptions.status` — applies the PREMIUM_TEST_EMAILS
 *      allowlist, so founder / QA accounts light up premium without a
 *      sandbox purchase. (50320 bugfix: the native cached user object had
 *      a stale `isPremium: 0` from login, masking the allowlist — this
 *      tRPC query guarantees we read the resolved flag directly from
 *      server truth on every mount + focus.)
 *   3. The legacy cached `user.isPremium` flag as first-paint fallback.
 */
export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const statusQuery = trpc.subscriptions.status.useQuery(undefined, {
    // Only query when we actually have a session to avoid a 401 storm on
    // the login screen.
    enabled: isAuthenticated,
    // Re-fetch when the user returns to the app — picks up entitlement
    // changes made on another device or a newly-added allowlist email.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const refetch = useCallback(async () => {
    await Promise.all([
      (async () => {
        try {
          const info = await Purchases.getCustomerInfo();
          setCustomerInfo(info);
        } catch (err) {
          console.warn("[useSubscription] failed to fetch customer info:", err);
        }
      })(),
      statusQuery.refetch().catch((err) => {
        console.warn("[useSubscription] status refetch failed:", err);
      }),
    ]);
  }, [statusQuery]);

  useEffect(() => {
    Purchases.getCustomerInfo()
      .then(setCustomerInfo)
      .catch((err) => console.warn("[useSubscription] initial fetch failed:", err));
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const isPremiumFromRevenueCat = !!customerInfo?.entitlements.active[ENTITLEMENT_ID];
  const isPremiumFromServerStatus = statusQuery.data?.isPremium === true;
  const isPremiumFromCachedUser = user?.isPremium === 1;
  const isPremium =
    isPremiumFromRevenueCat || isPremiumFromServerStatus || isPremiumFromCachedUser;

  return {
    isPremium,
    isFree: !isPremium,
    customerInfo,
    refetch,
  };
}
