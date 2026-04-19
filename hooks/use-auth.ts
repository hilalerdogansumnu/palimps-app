import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { onAuthChange } from "@/lib/_core/auth";
import { devLog } from "@/lib/_core/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    devLog("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        devLog("[useAuth] Web platform: fetching user from API...");
        const apiUser = await Api.getMe();
        devLog("[useAuth] API user response:", apiUser ? "present" : "missing");

        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            isPremium: apiUser.isPremium || 0,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          devLog("[useAuth] Web user set from API");
        } else {
          devLog("[useAuth] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      devLog("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      devLog("[useAuth] Session token:", sessionToken ? "present" : "missing");
      if (!sessionToken) {
        devLog("[useAuth] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      devLog("[useAuth] Cached user:", cachedUser ? "present" : "missing");
      if (cachedUser) {
        devLog("[useAuth] Using cached user info");
        setUser(cachedUser);
      } else {
        devLog("[useAuth] No cached user, setting user to null");
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      devLog("[useAuth] fetchUser completed");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    devLog("[useAuth] useEffect triggered, autoFetch:", autoFetch, "platform:", Platform.OS);
    if (autoFetch) {
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        devLog("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          devLog("[useAuth] Native cached user check:", cachedUser ? "present" : "missing");
          if (cachedUser) {
            devLog("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      devLog("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  // Re-fetch when auth state changes (e.g. after login)
  useEffect(() => {
    const unsubscribe = onAuthChange(() => {
      devLog("[useAuth] Auth change detected, re-fetching...");
      fetchUser();
    });
    return unsubscribe;
  }, [fetchUser]);

  useEffect(() => {
    devLog("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
