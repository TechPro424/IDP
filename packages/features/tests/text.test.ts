import { extractTextFeatures } from '../src/text.js';

(async () => {
  const text = 'Hello world! Hello again. Test test test.';
  const features = await extractTextFeatures(text);
  console.log('Text features:', features);
  for (const key of ['tokenEntropy', 'typeTokenRatio', 'repeatedNgramRatio', 'gzipRatio', 'sentenceLengthVariance'] as const) {
    if (features[key] === undefined) throw new Error(`${key} missing`);
  }
  if (features.gzipRatio! <= 0) throw new Error('gzipRatio should be positive for non-empty text');

  const empty = await extractTextFeatures('   ');
  if (Object.keys(empty).length !== 0) throw new Error('Empty text should yield no features');
  console.log('Text test passed.');
})();
