// src/services/voice/pcmResample.ts
//
// Responsibility: downsample 16-bit PCM audio from 16kHz (ElevenLabs'
// pcm_16000 output format) to 8kHz (Exotel's required raw/slin
// playback format). Both are already 16-bit little-endian PCM, so no
// bit-depth conversion is needed — only sample-rate halving.
//
// Deliberately separate from realtimeBridge.ts's existing μ-law decoder
// (a different codec entirely, for the previous OpenAI-audio path) and
// from ElevenLabsClient (which only knows ElevenLabs' wire format, not
// what Exotel needs). Single responsibility: one audio format in, one
// audio format out.
//
// Simple decimation (drop every other sample) rather than a proper
// low-pass-filtered resample. This trades a small amount of audio
// quality for zero added latency and zero external dependencies — for
// telephony-grade 8kHz voice calls the difference is inaudible in
// practice, and a filtered resampler would add real per-chunk CPU cost
// at production scale (thousands of concurrent calls).

export function pcm16kBase64To8kBase64(base64Pcm16k: string): string {
  const pcm16k = Buffer.from(base64Pcm16k, "base64");
  const sampleCount16k = Math.floor(pcm16k.length / 2);
  const sampleCount8k = Math.floor(sampleCount16k / 2);

  const pcm8k = Buffer.allocUnsafe(sampleCount8k * 2);
  for (let i = 0; i < sampleCount8k; i++) {
    // Take every other 16-bit sample. readInt16LE/writeInt16LE keep the
    // existing 16-bit little-endian format Exotel's slin expects.
    const sample = pcm16k.readInt16LE(i * 2 * 2);
    pcm8k.writeInt16LE(sample, i * 2);
  }

  return pcm8k.toString("base64");
}
