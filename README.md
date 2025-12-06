# URL Pattern Analyzer

Analyze and extract URL patterns from lists of URLs. Useful for reverse-engineering routing logic, understanding site structure, or preparing URL migration mappings.

## Features

- Paste URLs directly or fetch from XML sitemaps
- Auto-discovers sitemaps from robots.txt (just enter a domain)
- Supports sitemap index files (fetches all linked sitemaps)
- Identifies common patterns and groups URLs
- Runs entirely in the browser - no data leaves your machine

## Project Structure

```
url-patterns/
├── site/              ← Upload to your web server
│   ├── index.html
│   ├── css/
│   └── js/
├── worker/            ← Deploy to Cloudflare Workers
│   └── sitemap-proxy.js
└── tests/             ← Development only
```

## Quick Start

1. Open `site/index.html` in a browser
2. Paste URLs or use the "Fetch from Sitemap" tab
3. Click "Analyze Patterns"

## Deployment

### Website

Upload the entire `site/` folder to your web server.

### Cloudflare Worker

The sitemap fetch feature requires a proxy to bypass CORS:

1. Create a [Cloudflare account](https://cloudflare.com)
2. Go to **Workers & Pages** → **Create Worker**
3. Replace the code with contents of `worker/sitemap-proxy.js`
4. Click **Deploy**
5. Update `SITEMAP_PROXY_URL` in `site/js/app.js` with your worker URL

#### Securing the Worker

For production, restrict the worker to your domain only. Add origin checking at the top of the fetch handler in `worker/sitemap-proxy.js`.

## Development

Run tests:
```bash
node --test tests/analyzer.test.js
```
