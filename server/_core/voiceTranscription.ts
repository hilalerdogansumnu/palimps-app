/**
 * Voice transcription helper.
 *
 * Stubbed out post-Manus migration: PALIMPS does not currently use
 * voice transcription. The placeholder is kept so any future caller
 * gets a clear error rather than a 404.
 */
export async function transcribeVoice(_params: unknown): Promise<{ text: string }> {
  throw new Error(
    "transcribeVoice() is not configured. Wire up a transcription provider " +
      "(e.g. OpenAI Whisper, Deepgram, Google Speech-to-Text) before calling this function.",
  );
}
