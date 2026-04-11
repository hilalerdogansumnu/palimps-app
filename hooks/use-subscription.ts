import { useCallback, useEffect, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { useAuth } from "./use-auth";

const ENTITLEMENT_ID = "premium";

/**
 * Hook to check whether the current user has an active premium subscription.
 *
 * Source of truth is RevenueCat (`Purchases.getCustomerInfo`). We fall back
 * to the cached `user.isPremium` flag from the server (kept in sync by the
 * RevenueCat webhook) for the first render so the UI doesn't flicker.
 */
export function useSubscription() {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const refetch = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (err) {
      console.warn("[useSubscription] failed to fetch customer info:", err);
    }
  }, []);

  useEffect(() => {
    refetch();
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refetch]);

  const isPremiumFromRevenueCat = !!customerInfo?.entitlements.active[ENTITLEMENT_ID];
  const isPremiumFromServer = user?.isPremium === 1;
  const isPremium = isPremiumFromRevenueCat || isPremiumFromServer;

  return {
    isPremium,
    isFree: !isPremium,
    customerInfo,
    refetch,
  };
}
