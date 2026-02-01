import { useAuth } from "./use-auth";

/**
 * Hook to check if the current user has premium subscription
 * Returns isPremium boolean based on user.isPremium field
 */
export function useSubscription() {
  const { user } = useAuth();
  
  const isPremium = user?.isPremium === 1;
  
  return {
    isPremium,
    isFree: !isPremium,
  };
}
