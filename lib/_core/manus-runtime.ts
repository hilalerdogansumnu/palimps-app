/**
 * Manus Runtime — DEPRECATED, kept as a no-op for back-compat.
 *
 * Originally this module bridged the Expo web app with the Manus next-agent
 * preview iframe so the parent container could inject safe-area insets.
 * After leaving the Manus platform we no longer run inside that iframe, so
 * every export here is a harmless stub.
 *
 * The file still exists because `app/_layout.tsx` imports it. Once the
 * import is removed in a future cleanup pass this file can be deleted.
 */

import type { Metrics } from "react-native-safe-area-context";

type SafeAreaCallback = (metrics: Metrics) => void;

/**
 * No-op subscriber. Returns an unsubscribe function that also does nothing.
 */
export function subscribeSafeAreaInsets(_callback: SafeAreaCallback): () => void {
  return () => {};
}

/**
 * No-op initializer. Previously notified the parent iframe that the app
 * was ready; now does nothing because we are no longer iframed.
 */
export function initManusRuntime(): void {
  // intentionally empty
}

/**
 * Always false in the post-Manus world — we are never inside a preview iframe.
 */
export function isRunningInPreviewIframe(): boolean {
  return false;
}
