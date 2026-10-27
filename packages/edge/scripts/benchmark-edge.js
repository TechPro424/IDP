// Placeholder benchmark for Edge storage backends
// In a real environment, this would measure Workers KV, Cache API, and Upstash latency.
// Here we simulate with a simple Map and log approximate values.

const N = 10000;
const prefixes = Array.from({length:N},(_,i)=>`prefix-${i}`);

async function benchMap() {
  const store = new Map();
  const startPut = Date.now();
  for (const p of prefixes) store.set(p, 'true');
  const endPut = Date.now();
  const startGet = Date.now();
  for (const p of prefixes) store.get(p);
  const endGet = Date.now();
  console.log('Map put time (ms):', endPut - startPut);
  console.log('Map get time (ms):', endGet - startGet);
}

benchMap();
