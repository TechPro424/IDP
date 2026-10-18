// Cloudflare Worker entry point
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  return new Response('Hello from Slop Filter Edge', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}
