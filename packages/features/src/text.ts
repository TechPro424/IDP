// Text feature extraction utilities. Browser-safe: uses the platform
// CompressionStream instead of node:zlib.
import { variance } from './audio.js';

export interface TextFeatures {
  tokenEntropy?: number;
  typeTokenRatio?: number;
  repeatedNgramRatio?: number;
  gzipRatio?: number;
  sentenceLengthVariance?: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

async function gzipRatio(text: string): Promise<number> {
  try {
    const bytes = new TextEncoder().encode(text);
    if (!bytes.length) return 0;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return buf.byteLength / bytes.byteLength;
  } catch {
    return 0;
  }
}

export async function extractTextFeatures(text: string): Promise<TextFeatures> {
  const tokens = tokenize(text);
  if (tokens.length === 0) return {};
  const totalTokens = tokens.length;
  const typeTokenRatio = new Set(tokens).size / totalTokens;

  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  let entropy = 0;
  for (const c of freq.values()) {
    const p = c / totalTokens;
    entropy -= p * Math.log2(p);
  }

  const ngramSize = 3;
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - ngramSize; i++) {
    ngrams.push(tokens.slice(i, i + ngramSize).join(' '));
  }
  const ngramFreq = new Map<string, number>();
  for (const g of ngrams) ngramFreq.set(g, (ngramFreq.get(g) ?? 0) + 1);
  const repeated = Array.from(ngramFreq.values()).filter((c) => c > 1).length;
  const repeatedNgramRatio = ngrams.length > 0 ? repeated / ngrams.length : 0;

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => tokenize(s).length)
    .filter((n) => n > 0);

  return {
    tokenEntropy: entropy,
    typeTokenRatio,
    repeatedNgramRatio,
    gzipRatio: await gzipRatio(text),
    sentenceLengthVariance: variance(sentences),
  };
}
