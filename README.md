# URL Pattern Analyzer

Analyze and extract URL patterns from lists of URLs. Useful for reverse-engineering routing logic, understanding site structure, or preparing URL migration mappings.

## Features

- Paste URLs directly or fetch from XML sitemaps
- Supports sitemap index files (fetches all linked sitemaps)
- Identifies common patterns and groups URLs
- Runs entirely in the browser - no data leaves your machine

## Quick Start

1. Open `index.html` in a browser
2. Paste URLs or use the "Fetch from Sitemap" tab
3. Click "Analyze Patterns"

## Deployment

### Static Files

Upload these files to any web server:
- `index.html`
- `css/style.css`
- `js/analyzer.js`
- `js/sitemap.js`
- `js/app.js`

### Cloudflare Worker (for sitemap fetching)

The sitemap fetch feature requires a proxy to bypass CORS. Deploy the worker:

1. Create a [Cloudflare account](https://cloudflare.com)
2. Go to **Workers & Pages** → **Create Worker**
3. Replace the code with contents of `worker/sitemap-proxy.js`
4. Click **Deploy**
5. Update `SITEMAP_PROXY_URL` in `js/app.js` with your worker URL

#### Securing the Worker (Production)

Uncomment and configure the `allowedOrigins` section in `worker/sitemap-proxy.js` to restrict access to your domain only.

## Development

Run tests:
```bash
node --test tests/analyzer.test.js
```
