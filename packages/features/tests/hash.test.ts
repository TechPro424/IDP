import { sha256Hex, hashVideoUrl, canonicalizeUrl } from '../src/hash.js';

(async () => {
  // Known SHA-256 vector.
  const h = await sha256Hex('abc');
  if (h !== 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') {
    throw new Error('SHA-256 vector mismatch: ' + h);
  }

  // Canonicalisation drops volatile params.
  const a = await hashVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s');
  const b = await hashVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz');
  if (a.prefix !== b.prefix || a.suffix !== b.suffix) throw new Error('Canonicalisation failed');
  if (a.prefix.length !== 5 || a.suffix.length !== 11) throw new Error('prefix/suffix lengths wrong');

  // Shorts keep their id.
  if (canonicalizeUrl('https://www.youtube.com/shorts/abc123XYZ_-') !== 'https://www.youtube.com/shorts/abc123XYZ_-') {
    throw new Error('Shorts canonicalisation failed');
  }

  console.log('Hash test passed.');
})();
