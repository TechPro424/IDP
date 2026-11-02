// Placeholder benchmark for Cloudflare Cache API.
// In practice, this would hit the Cache API endpoint for GET/PUT.
const N = 100;
const baseUrl = process.env.BASE_URL || 'https://example.com';

async function benchCacheGet() {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const start = Date.now();
    await fetch(`${baseUrl}/cache/${i}`);
    total += Date.now() - start;
  }
  console.log(`Cache GET avg ${total / N} ms`);
}

async function benchCachePut() {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const start = Date.now();
    await fetch(`${baseUrl}/cache/${i}`, { method: 'PUT', body: 'data' });
    total += Date.now() - start;
  }
  console.log(`Cache PUT avg ${total / N} ms`);
}

(async () => {
  await benchCacheGet();
  await benchCachePut();
})();
