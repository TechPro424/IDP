import { extractTextFeatures } from '../src/text';

// Simple test
const text = 'Hello world! Hello again. Test test test.';
const features = extractTextFeatures(text);
console.log('Text features:', features);
if (features.tokenEntropy === undefined) throw new Error('tokenEntropy missing');
if (features.typeTokenRatio === undefined) throw new Error('typeTokenRatio missing');
if (features.repeatedNgramRatio === undefined) throw new Error('repeatedNgramRatio missing');
if (features.gzipRatio === undefined) throw new Error('gzipRatio missing');
console.log('Text test passed.');
