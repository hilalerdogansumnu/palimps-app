import * as Sentry from "@sentry/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const PULSE_STORAGE_KEY_PREFIX = "@palimps/sentry-pulse-sent-";

/**
 * Initialize Sentry for crash reporting and error tracking
 * Call this early in app startup (in app/_layout.tsx)
 */
export function initSentry() {
  // Expo only inlines env vars into the client bundle when they are prefixed
  // with EXPO_PUBLIC_. The previous plain `SENTRY_DSN` read resolved to
  // undefined at runtime even if the variable was set in eas.json — the core
  // of the Layer 1 gap documented in AMND-2026-001.
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn("SENTRY_DSN not set, crash reporting disabled");
    return;
  }

  const appVersion = Constants.expoConfig?.version ?? "0.0.0";
  const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? "0";
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier ?? "app";
  const environment =
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? "development" : "production");

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Capture breadcrumbs for better debugging
    maxBreadcrumbs: 100,
    // Attach stack traces to all messages
    attachStacktrace: true,
    // AMND-2026-001 release gate: events must be tagged with the shipping
    // build number so "Sentry has a pulse from THIS build" is verifiable.
    release: `${bundleId}@${appVersion}+${buildNumber}`,
    dist: buildNumber,
    // KVKK / observability SKILL: do not send IP / User-Agent by default.
    sendDefaultPii: false,
    // Ignore certain errors
    ignoreErrors: [
      // Network errors that are expected
      "Network request failed",
      "The operation couldn't be completed",
      // React Navigation errors
      "Non-serializable value was detected",
    ],
    // Before sending to Sentry, filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive data from error messages
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Don't send auth tokens or API keys
          if (error.message.includes("token") || error.message.includes("key")) {
            return null;
          }
        }
      }
      return event;
    },
  });

  // AMND-2026-001 release gate: fire a pulse the first time each build boots
  // on a given install. Release-manager relies on this reaching the Sentry
  // dashboard before flipping the phased-rollout switch. Fire-and-forget —
  // never block app startup on this, never throw out of it.
  sendReleaseHealthPulse({ buildNumber, bundleId, appVersion, environment }).catch(
    () => {
      // Swallow — the health check failing must not impact the app at boot.
    }
  );
}

/**
 * Fire a Sentry "release-health-check" event, once per (install × build).
 *
 * Owned by palimps-observability-engineer. Called automatically from
 * initSentry on first cold start of each new build. Guarded by AsyncStorage
 * so reopening the app on the same build does not produce noise (cf.
 * observability SKILL: "metrics that fire during normal operation are worse
 * than useless").
 */
async function sendReleaseHealthPulse(args: {
  buildNumber: string;
  bundleId: string;
  appVersion: string;
  environment: string;
}) {
  const { buildNumber, bundleId, appVersion, environment } = args;
  const key = `${PULSE_STORAGE_KEY_PREFIX}${buildNumber}`;
  const alreadySent = await AsyncStorage.getItem(key);
  if (alreadySent) return;

  Sentry.captureMessage("release-health-check", {
    level: "info",
    tags: {
      pulse: "true",
      build: buildNumber,
      bundle_id: bundleId,
      app_version: appVersion,
      environment,
    },
  });

  await AsyncStorage.setItem(key, new Date().toISOString());
}

/**
 * Set or clear the Sentry user context. Call after login with the user's
 * openId, and on sign-out with no argument / null to clear.
 *
 * Module-level export so it can be imported normally instead of reached
 * through `initSentry()`'s return value. (AMND-2026-001: the previous
 * pattern — local closure returned from initSentry, re-read via
 * `require(...).setUserContext` inside a useEffect — resolved to
 * `undefined` in the production bundle and crashed the post-login tree
 * with "TypeError: undefined is not a function" at commitHookEffectListMount.)
 */
export function setUserContext(userId?: string | null) {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture exceptions that don't crash the app
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      app: context,
    },
  });
}

/**
 * Capture messages for debugging
 */
export function captureMessage(message: string, level: "fatal" | "error" | "warning" | "info" | "debug" = "info") {
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    data,
    level: "info",
  });
}

/**
 * Wrap async operations with error tracking
 */
export async function withErrorTracking<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T | null> {
  try {
    addBreadcrumb(`Starting: ${operationName}`);
    const result = await operation();
    addBreadcrumb(`Completed: ${operationName}`);
    return result;
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      operation: operationName,
    });
    return null;
  }
}
