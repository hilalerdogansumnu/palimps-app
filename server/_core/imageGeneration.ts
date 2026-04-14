/**
 * Image generation helper.
 *
 * Stubbed out post-Manus migration: PALIMPS does not currently use
 * AI image generation. The placeholder is kept so any future caller
 * gets a clear error rather than a 404.
 */
export async function generateImage(_params: unknown): Promise<{ url: string }> {
  throw new Error(
    "generateImage() is not configured. Wire up an image generation provider " +
      "(e.g. fal.ai, Replicate, Stability) before calling this function.",
  );
}
