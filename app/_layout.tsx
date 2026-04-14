import "@/global.css";
import "@/lib/i18n";
import { initSentry } from "@/lib/_core/sentry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Initialize Sentry for crash reporting
initSentry();
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
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
import { router, useSegments } from "expo-router";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingScreens } from "@/components/onboarding-screens";
import { ErrorBoundary } from "@/components/error-boundary";
import { View, ActivityIndicator } from "react-native";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const { isOnboardingCompleted, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();

  // Tie the RevenueCat customer record to our internal openId so the
  // webhook can flip the premium flag when Apple confirms the purchase.
  useEffect(() => {
    if (user?.openId) {
      identifyPurchasesUser(user.openId);
      // Set user context in Sentry for crash reporting
      const { setUserContext } = require("@/lib/_core/sentry");
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

  // Show loading while checking onboarding status
  if (onboardingLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#0a7ea4" />
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
