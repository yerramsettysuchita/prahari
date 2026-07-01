// Convert a recorded audio blob (webm/opus from MediaRecorder) into a mono
// 16 bit WAV blob, which Gemini accepts for audio understanding. The browser
// decodes its own recording, then we re-encode to PCM WAV.

export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AC();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  try {
    await ctx.close();
  } catch {}
  return encodeWavMono(audioBuffer);
}

function encodeWavMono(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // Downmix all channels to mono.
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numCh; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numCh;
  }

  const dataSize = length * 2; // 16 bit
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  let p = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i));
  };

  writeStr("RIFF");
  view.setUint32(p, 36 + dataSize, true);
  p += 4;
  writeStr("WAVE");
  writeStr("fmt ");
  view.setUint32(p, 16, true);
  p += 4;
  view.setUint16(p, 1, true); // PCM
  p += 2;
  view.setUint16(p, 1, true); // mono
  p += 2;
  view.setUint32(p, sampleRate, true);
  p += 4;
  view.setUint32(p, sampleRate * 2, true); // byte rate
  p += 4;
  view.setUint16(p, 2, true); // block align
  p += 2;
  view.setUint16(p, 16, true); // bits per sample
  p += 2;
  writeStr("data");
  view.setUint32(p, dataSize, true);
  p += 4;

  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}
