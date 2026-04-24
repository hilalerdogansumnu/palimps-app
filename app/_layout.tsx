import "@/global.css";
import "@/lib/i18n";
import { initSentry, setUserContext } from "@/lib/_core/sentry";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import * as Auth from "@/lib/_core/auth";
import { isSessionExpireError } from "@/lib/_core/auth-error";
import { Stack , router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform , View, ActivityIndicator } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initPurchases, identifyPurchasesUser } from "@/lib/_core/purchases";
import { subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { initManusRuntime } from "@/lib/_core/manus-runtime"; // Keep for compatibility
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingScreens } from "@/components/onboarding-screens";
import { ErrorBoundary } from "@/components/error-boundary";
import { useColors } from "@/hooks/use-colors";

// Initialize Sentry for crash reporting
initSentry();

/**
 * Global tRPC/React Query error interceptor — session expire handling.
 *
 * Backend returns 401 when the session cookie/token is invalid/expired.
 * tRPC wraps this as a TRPCClientError with `data.httpStatus === 401` or
 * message "Please login (10001)". Previously this error bubbled up as an
 * uncaught exception → Sentry captureException (see IOS-4 issue, 7 events
 * across 5 days), and the user stayed on the failing screen with no
 * recovery path.
 *
 * Fix: any query/mutation error → check auth-shape via isSessionExpireError
 * → if so, clear local session + notify useAuth. AuthGuard useEffect reacts
 * (isAuthenticated becomes false), redirects to /login. User sees login
 * screen within one frame of the 401 instead of a dead error alert.
 *
 * Detection helper: @/lib/_core/auth-error → pure function, unit tested
 * with positive/negative/boundary cases. Protects against regression in the
 * session expire signal (e.g. someone loosening the match to `/login/i`
 * and catching "last login was..." strings).
 *
 * Sentry: captureException DEĞİL, addBreadcrumb kullanıyoruz — session
 * expire **beklenen** bir akış (TTL, revocation), unhandled exception
 * değil. Crash noise'unu azaltır, yine de forensic için breadcrumb kalır.
 */

let sessionExpireInProgress = false;
function handleAuthError(error: unknown) {
  if (!isSessionExpireError(error)) return;
  // Birden fazla in-flight tRPC call'u aynı anda 401 yerse handler N kez
  // ateşlenir; session clear idempotent ama breadcrumb spam'i + navigation
  // race'i önlemek için guard. notifyAuthChange sonrası useAuth yeniden
  // fetch eder + AuthGuard redirect eder — o pencerede flag set kalır.
  if (sessionExpireInProgress) return;
  sessionExpireInProgress = true;
  Sentry.addBreadcrumb({
    category: "auth.session.expired",
    level: "warning",
    message: "tRPC returned 401, auto-logout flow triggered",
  });
  // Fire-and-forget — queryCache onError sync callback, async clear'ler
  // arka planda tamamlansın. useAuth re-fetch ve AuthGuard redirect için
  // notifyAuthChange yeterli.
  Promise.all([
    Auth.removeSessionToken().catch(() => {}),
    Auth.clearUserInfo().catch(() => {}),
  ]).finally(() => {
    Auth.notifyAuthChange();
    // Bir sonraki session döngüsünde (kullanıcı yeniden login olunca)
    // flag reset olsun.
    setTimeout(() => {
      sessionExpireInProgress = false;
    }, 2000);
  });
}

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const { isOnboardingCompleted, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const colors = useColors();

  // Tie the RevenueCat customer record to our internal openId so the
  // webhook can flip the premium flag when Apple confirms the purchase.
  useEffect(() => {
    if (user?.openId) {
      identifyPurchasesUser(user.openId);
      // Set user context in Sentry for crash reporting
      setUserContext(user.openId);
    }
  }, [user?.openId]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(tabs)";
    const inLoginScreen = segments[0] === "login";

    if (!isAuthenticated && inAuthGroup) {
      // Kullanıcı giriş yapmamış ve korumalı bir sayfada, login'e yönlendir
      router.replace("/login");
    } else if (isAuthenticated && inLoginScreen) {
      // Kullanıcı giriş yapmış ve login sayfasında, ana sayfaya yönlendir
      router.replace("/");
    }
  }, [isAuthenticated, loading, segments]);

  // Show loading while checking onboarding status.
  // Use themed colors so dark-mode users don't see a white flash on cold start.
  if (onboardingLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show onboarding for authenticated users who haven't completed it
  if (isAuthenticated && !isOnboardingCompleted) {
    return <OnboardingScreens onComplete={completeOnboarding} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize RevenueCat once at startup.
  useEffect(() => {
    initPurchases();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleAuthError }),
        mutationCache: new MutationCache({ onError: handleAuthError }),
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="add-book" options={{ presentation: "modal" }} />
              <Stack.Screen name="book/[id]" />
              <Stack.Screen name="add-moment/[bookId]" options={{ presentation: "modal" }} />
              <Stack.Screen name="moment/[id]" />
              <Stack.Screen name="notification-settings" />
            </Stack>
          </AuthGuard>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
