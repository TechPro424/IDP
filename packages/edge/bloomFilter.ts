// Simple Bloom filter implementation using two hash functions
export class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashCount: number;
  constructor(sizeBits: number = 1_000_000, hashCount: number = 2, bits?: Uint8Array) {
    this.size = sizeBits;
    this.hashCount = hashCount;
    this.bits = bits ?? new Uint8Array(Math.ceil(sizeBits / 8));
  }

  private _hashes(value: string): number[] {
    const hashes: number[] = [];
    // Simple hash functions using built-in string char codes
    let h1 = 0;
    let h2 = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      h1 = ((h1 << 5) - h1) + c;
      h1 |= 0;
      h2 = ((h2 << 3) - h2) + c;
      h2 |= 0;
    }
    for (let i = 0; i < this.hashCount; i++) {
      const seed = i === 0 ? h1 : h2;
      const hash = (seed ^ value.length) >>> 0;
      hashes.push(hash % this.size);
    }
    return hashes;
  }

  add(value: string): void {
    const indices = this._hashes(value);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      this.bits[byteIdx] |= 1 << bitIdx;
    }
  }

  test(value: string): boolean {
    const indices = this._hashes(value);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      if ((this.bits[byteIdx] & (1 << bitIdx)) === 0) {
        return false;
      }
    }
    return true;
  }

  // Persistable representation
  toJSON(): { bits: number[]; size: number; hashCount: number } {
    return {
      bits: Array.from(this.bits),
      size: this.size,
      hashCount: this.hashCount,
    };
  }

  static fromJSON(obj: { bits: number[]; size: number; hashCount: number }): BloomFilter {
    return new BloomFilter(obj.size, obj.hashCount, Uint8Array.from(obj.bits));
  }
}
