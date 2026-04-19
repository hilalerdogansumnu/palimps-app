/**
 * Development-only console logging.
 *
 * In production builds `__DEV__` is `false` and these become no-ops — Metro's
 * minifier strips them out, so verbose traces don't ship in the App Store
 * binary and don't leak PII via sysdiagnose.
 *
 * Usage:
 *   import { devLog, devWarn } from "@/lib/_core/logger";
 *   devLog("[Auth] Session token retrieved");
 *
 * Rules:
 * - Use `devLog` / `devWarn` for anything that may include tokens, user
 *   objects, request/response headers, cookies, or any verbose trace.
 * - Keep `console.error` for actual errors you want to see in release builds
 *   (Sentry captures them as breadcrumbs).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog: (...args: any[]) => void = __DEV__
  ? console.log.bind(console)
  : () => {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devWarn: (...args: any[]) => void = __DEV__
  ? console.warn.bind(console)
  : () => {};
