// Text feature extraction utilities

export interface TextFeatures {
  tokenEntropy?: number;
  typeTokenRatio?: number;
  repeatedNgramRatio?: number;
  gzipRatio?: number;
}

// Helper: simple tokenization by whitespace and punctuation
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function extractTextFeatures(text: string): TextFeatures {
  const tokens = tokenize(text);
  if (tokens.length === 0) return {};
  const totalTokens = tokens.length;
  const uniqueTokens = new Set(tokens).size;
  const typeTokenRatio = uniqueTokens / totalTokens;

  // Entropy calculation (base 2)
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  let entropy = 0;
  for (const [_, c] of freq) {
    const p = c / totalTokens;
    entropy -= p * Math.log2(p);
  }

  // 3-gram repetition ratio
  const ngramSize = 3;
  const ngrams = [] as string[];
  for (let i = 0; i <= tokens.length - ngramSize; i++) {
    ngrams.push(tokens.slice(i, i + ngramSize).join(' '));
  }
  const ngramFreq = new Map<string, number>();
  for (const g of ngrams) {
    ngramFreq.set(g, (ngramFreq.get(g) ?? 0) + 1);
  }
  const repeated = Array.from(ngramFreq.values()).filter(c => c > 1).length;
  const repeatedNgramRatio = ngrams.length > 0 ? repeated / ngrams.length : 0;

  // Gzip ratio
  let gzipRatio = 0;
  try {
    // Node's zlib is available in the test environment
    const zlib = require('zlib');
    const buffer = Buffer.from(text, 'utf8');
    const compressed = zlib.deflateSync(buffer);
    gzipRatio = compressed.length / buffer.length;
  } catch (_) {
    gzipRatio = 0;
  }

  return {
    tokenEntropy: entropy,
    typeTokenRatio,
    repeatedNgramRatio,
    gzipRatio,
  };
}
