/**
 * Session expire / auth error detection.
 *
 * Backend `/api/trpc/*` 401 response → tRPC client TRPCClientError.
 * PALIMPS auth layer ayrıca custom "Please login (10001)" mesajı da
 * üretebiliyor (tRPC'nin UNAUTHORIZED sarmalamadığı durumlar).
 *
 * Bu helper app/_layout.tsx'teki global QueryCache + MutationCache
 * onError handler'ı tarafından çağrılır; eşleşme varsa session-clear
 * + auto-logout akışı tetiklenir.
 *
 * PURE, side-effect-free. Unit test için ayrı dosyaya alındı
 * (lib/_core/auth-error.test.ts).
 */

export function isSessionExpireError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const data = (error as { data?: { httpStatus?: number; code?: string } }).data;
  if (data?.httpStatus === 401) return true;
  if (data?.code === "UNAUTHORIZED") return true;

  const message = (error as { message?: string }).message;
  if (typeof message !== "string") return false;

  // Backend "Please login (10001)" + varyasyonlar (case, suffix, prefix).
  // Regex case-insensitive "please login" prefix'i arıyor — "please login"
  // cümlesi başka bir normal error'da geçmediği için false positive riski
  // düşük.
  return /^please login/i.test(message);
}
