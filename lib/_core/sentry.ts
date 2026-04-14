import * as Sentry from "@sentry/react-native";
import { Platform } from "react-native";

/**
 * Initialize Sentry for crash reporting and error tracking
 * Call this early in app startup (in app/_layout.tsx)
 */
export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn("SENTRY_DSN not set, crash reporting disabled");
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Capture breadcrumbs for better debugging
    maxBreadcrumbs: 100,
    // Attach stack traces to all messages
    attachStacktrace: true,
    // Release version (should match app.config.ts version)
    release: "1.0.0",
    // Enable native crash reporting on iOS/Android
    enableNativeCrashHandling: true,
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

  // Set user context if available
  const setUserContext = (userId?: string) => {
    if (userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  };

  // Export for use in auth flow
  return { setUserContext };
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
