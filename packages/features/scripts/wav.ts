// Node-only WAV reader for the corpus tooling. Not part of the browser bundle.
import { readFileSync } from 'node:fs';

export interface Wav {
  data: Float32Array;
  sampleRate: number;
}

/**
 * Read a RIFF/WAVE file as mono float32 in [-1, 1].
 * Handles PCM 8/16/24/32-bit and IEEE float32; multi-channel is averaged.
 */
export function readWav(path: string): Wav {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`);
  }
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let dataOff = -1;
  let dataLen = 0;
  for (let off = 12; off + 8 <= buf.length; ) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      dataOff = body;
      dataLen = Math.min(size, buf.length - body);
      break;
    }
    off = body + size + (size % 2);
  }
  if (!channels || !sampleRate || dataOff < 0) throw new Error(`${path}: missing fmt or data chunk`);

  const bytesPerSample = bits / 8;
  const frames = Math.floor(dataLen / (bytesPerSample * channels));
  const data = new Float32Array(frames);
  const view = Buffer.from(buf.buffer, buf.byteOffset + dataOff, dataLen);

  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const p = (i * channels + c) * bytesPerSample;
      if (format === 3 && bits === 32) sum += view.readFloatLE(p);
      else if (bits === 8) sum += (view.readUInt8(p) - 128) / 128;
      else if (bits === 16) sum += view.readInt16LE(p) / 32768;
      else if (bits === 24) sum += view.readIntLE(p, 3) / 8388608;
      else if (bits === 32) sum += view.readInt32LE(p) / 2147483648;
      else throw new Error(`${path}: unsupported ${bits}-bit format ${format}`);
    }
    data[i] = sum / channels;
  }
  return { data, sampleRate };
}