// src/services/voice/pcmResample.ts
//
// Responsibility: sample-rate conversion for 16-bit little-endian PCM
// audio between the rates used on either side of this bridge. Both
// directions deal exclusively with 16-bit LE PCM — no bit-depth or
// codec conversion is ever done here.
//
// Two directions, two functions:
//
//   pcm16kBase64To8kBase64  — ElevenLabs (16kHz) -> Exotel (8kHz)
//                              downsample by decimation.
//
//   pcm8kBase64To24kBase64  — Exotel (8kHz) -> OpenAI Realtime (24kHz)
//                              upsample by linear interpolation.
//
// Both are deliberately simple, dependency-free, per-chunk-cheap
// implementations. For 8kHz telephony-grade voice, a full
// filtered/windowed resampler is not worth the added CPU cost at
// production scale (thousands of concurrent calls); decimation on the
// way down and linear interpolation on the way up are both standard,
// well-understood tradeoffs for this quality tier.

// ---------------------------------------------------------------------
// Downsample: 16kHz -> 8kHz (existing, unmodified)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// Upsample: 8kHz -> 24kHz (new)
// ---------------------------------------------------------------------
//
// Exotel's Voicebot Media Stream sends raw/slin PCM16, 8kHz, mono,
// little-endian. OpenAI Realtime GA's audio/pcm input format only
// accepts a fixed 24kHz sample rate (confirmed in OpenAI's official
// API reference: "Only a 24kHz sample rate is supported"). 24000 / 8000
// is an exact integer ratio of 3, so each output sample is produced by
// linearly interpolating between the two nearest input samples.
//
// This runs on every inbound caller-audio chunk for every live call,
// so it's written as a single tight loop over a preallocated buffer —
// no intermediate arrays, no per-sample allocation.
export function pcm8kBase64To24kBase64(base64Pcm8k: string): string {
  const pcm8k = Buffer.from(base64Pcm8k, "base64");
  const sampleCount8k = Math.floor(pcm8k.length / 2);

  if (sampleCount8k === 0) {
    return "";
  }

  if (sampleCount8k === 1) {
    // Degenerate case: nothing to interpolate against. Repeat the
    // single sample across the 3x window rather than special-casing
    // the caller.
    const only = pcm8k.readInt16LE(0);
    const single = Buffer.allocUnsafe(6);
    single.writeInt16LE(only, 0);
    single.writeInt16LE(only, 2);
    single.writeInt16LE(only, 4);
    return single.toString("base64");
  }

  const UPSAMPLE_RATIO = 3; // 24000 / 8000
  const sampleCount24k = sampleCount8k * UPSAMPLE_RATIO;
  const pcm24k = Buffer.allocUnsafe(sampleCount24k * 2);

  for (let i = 0; i < sampleCount8k; i++) {
    const current = pcm8k.readInt16LE(i * 2);
    // Use the next input sample for interpolation; clamp to the last
    // sample for the final window so we never read out of bounds.
    const next = i + 1 < sampleCount8k ? pcm8k.readInt16LE((i + 1) * 2) : current;

    for (let j = 0; j < UPSAMPLE_RATIO; j++) {
      const t = j / UPSAMPLE_RATIO;
      const interpolated = current + (next - current) * t;
      const outIndex = (i * UPSAMPLE_RATIO + j) * 2;
      pcm24k.writeInt16LE(Math.round(interpolated), outIndex);
    }
  }

  return pcm24k.toString("base64");
}
