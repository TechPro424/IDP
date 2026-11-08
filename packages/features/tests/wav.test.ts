// Round-trips a WAV built in memory through readWav: chunk parsing, bit depth,
// and channel downmix. No fixture files.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWav } from '../scripts/wav.js';
import assert from 'node:assert';

function wav(
  samples: number[],
  { channels = 1, bits = 16, sampleRate = 16000, float = false }: { channels?: number; bits?: number; sampleRate?: number; float?: boolean } = {},
) {
  const bytesPerSample = bits / 8;
  const data = Buffer.alloc(samples.length * bytesPerSample);
  samples.forEach((s, i) => {
    const p = i * bytesPerSample;
    if (float) data.writeFloatLE(s, p);
    else if (bits === 16) data.writeInt16LE(Math.round(s * 32767), p);
    else if (bits === 24) data.writeIntLE(Math.round(s * 8388607), p, 3);
    else if (bits === 8) data.writeUInt8(Math.round(s * 127) + 128, p);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(float ? 3 : 1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  const dir = mkdtempSync(join(tmpdir(), 'slop-wav-'));
  const path = join(dir, 't.wav');
  writeFileSync(path, Buffer.concat([header, data]));
  return path;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

// 16-bit mono
{
  const { data, sampleRate } = readWav(wav([0.5, -0.5, 0.25]));
  assert.equal(sampleRate, 16000);
  assert.equal(data.length, 3);
  assert.ok(near(data[0], 0.5) && near(data[1], -0.5) && near(data[2], 0.25), 'pcm16 values');
}

// stereo downmix averages the channels
{
  const { data } = readWav(wav([1, 0, 0, 1], { channels: 2 }));
  assert.equal(data.length, 2);
  assert.ok(near(data[0], 0.5) && near(data[1], 0.5), 'downmix');
}

// float32 and 8-bit
{
  assert.ok(near(readWav(wav([0.3, -0.3], { float: true, bits: 32 })).data[0], 0.3), 'float32');
  const eight = readWav(wav([0.5], { bits: 8 })).data[0];
  assert.ok(Math.abs(eight - 0.5) < 0.02, '8-bit midpoint');
}

// 24-bit sign extension
{
  const { data } = readWav(wav([-0.5, 0.5], { bits: 24 }));
  assert.ok(near(data[0], -0.5) && near(data[1], 0.5), 'pcm24');
}

console.log('WAV reader tests passed.');