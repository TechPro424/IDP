// Bloom filter with double hashing (Kirsch–Mitzenmacher) and a compact
// binary wire format for the versioned blob endpoint.
export interface BloomOptions {
  expectedItems: number;
  falsePositiveRate: number;
}

export function optimalParameters(n: number, p: number): { bits: number; hashes: number } {
  const bits = Math.max(1, Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2)));
  const hashes = Math.max(1, Math.round((bits / n) * Math.LN2));
  return { bits, hashes };
}

// FNV-1a 32-bit.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// MurmurHash3 finalizer over char codes — good avalanche, cheap.
function murmur(str: string): number {
  let h = 0x9747b28c;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

const MAGIC = 0x42463031; // "BF01"

export class BloomFilter {
  sizeBits: number;
  hashCount: number;
  private bits: Uint8Array;

  constructor(options: BloomOptions = { expectedItems: 10_000, falsePositiveRate: 0.001 }, bits?: Uint8Array) {
    const { bits: sizeBits, hashes } = optimalParameters(options.expectedItems, options.falsePositiveRate);
    this.sizeBits = sizeBits;
    this.hashCount = hashes;
    this.bits = bits && bits.length >= Math.ceil(sizeBits / 8) ? bits : new Uint8Array(Math.ceil(sizeBits / 8));
  }

  private indices(value: string): number[] {
    const h1 = fnv1a(value);
    const h2 = (murmur(value) | 1) >>> 0; // odd → coprime with power-of-two-ish moduli
    const out: number[] = [];
    for (let i = 0; i < this.hashCount; i++) out.push((h1 + i * h2) % this.sizeBits);
    return out;
  }

  add(value: string): void {
    for (const idx of this.indices(value)) {
      this.bits[idx >>> 3] |= 1 << (idx & 7);
    }
  }

  test(value: string): boolean {
    for (const idx of this.indices(value)) {
      if ((this.bits[idx >>> 3] & (1 << (idx & 7))) === 0) return false;
    }
    return true;
  }

  /** Current false-positive estimate given the number of insertions. */
  estimateFpr(insertions: number): number {
    return Math.pow(1 - Math.exp((-this.hashCount * insertions) / this.sizeBits), this.hashCount);
  }

  toBinary(): Uint8Array {
    const out = new Uint8Array(12 + this.bits.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, MAGIC, false);
    view.setUint32(4, this.sizeBits, false);
    view.setUint32(8, this.hashCount, false);
    out.set(this.bits, 12);
    return out;
  }

  static fromBinary(input: Uint8Array | ArrayBuffer): BloomFilter {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, false) !== MAGIC) throw new Error('BloomFilter: bad magic');
    const sizeBits = view.getUint32(4, false);
    const hashCount = view.getUint32(8, false);
    const filter: BloomFilter = Object.create(BloomFilter.prototype);
    filter.sizeBits = sizeBits;
    filter.hashCount = hashCount;
    (filter as any).bits = bytes.slice(12);
    return filter;
  }
}
