/**
 * Cloudflare Worker - Sitemap Proxy
 *
 * Proxies sitemap requests to bypass CORS restrictions.
 * Deploy this to Cloudflare Workers and update SITEMAP_PROXY_URL in js/app.js
 *
 * Usage: https://your-worker.workers.dev/?url=https://example.com/sitemap.xml
 */

export default {
  async fetch(request) {
    // Optional: Restrict to specific origins (uncomment and configure for production)
    // const allowedOrigins = [
    //   'https://yourdomain.com',
    //   'http://localhost',
    //   'http://127.0.0.1',
    //   'null'  // For file:// protocol
    // ];
    //
    // const origin = request.headers.get('Origin') || '';
    // const isAllowed = allowedOrigins.some(allowed =>
    //   origin === allowed || origin.startsWith(allowed)
    // );
    //
    // if (!isAllowed && origin !== '') {
    //   return new Response('Forbidden', { status: 403 });
    // }

    const url = new URL(request.url).searchParams.get('url');

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SitemapFetcher/1.0' }
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `HTTP ${response.status}` }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const content = await response.text();
      return new Response(content, {
        headers: {
          'Content-Type': 'application/xml',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
