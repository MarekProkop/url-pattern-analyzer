# URL Pattern Analyzer

Analyze and extract URL patterns from lists of URLs. Useful for reverse-engineering routing logic, understanding site structure, or preparing URL migration mappings.

**[Try the Live Demo](https://www.prokopsw.cz/app/url-patterns/)**

## Features

- Paste URLs directly or fetch from XML sitemaps
- Auto-discovers sitemaps from robots.txt (just enter a domain)
- Supports sitemap index files (fetches all linked sitemaps)
- Identifies common patterns and groups URLs
- Runs entirely in the browser - no data leaves your machine

## Limitations

The sitemap fetching feature has the following limits:

- **Maximum 50 sitemaps** - Sitemap indexes with more than 50 child sitemaps are not supported. Use the "Paste URLs" tab instead.
- **Maximum 300,000 URLs** - If a sitemap contains more URLs, only the first 300,000 will be collected.

## For Users

The easiest way to use this tool is via the **[live demo](https://www.prokopsw.cz/app/url-patterns/)**.

1. Open the app
2. Paste your URLs or enter a domain to fetch from sitemap
3. Click "Analyze Patterns"
4. View grouped URL patterns with counts

### Example

Input:
```
https://example.com/products/123
https://example.com/products/456
https://example.com/products/789
https://example.com/blog/hello-world
https://example.com/blog/good-bye-world
```

Output:
```
https://example.com/products/...  (3 URLs)
https://example.com/blog/...      (2 URL)
```

## For Developers

### Project Structure

```
url-patterns/
├── site/              ← Frontend (upload to web server)
│   ├── index.html
│   ├── css/
│   └── js/
├── worker/            ← Cloudflare Worker (for sitemap fetching)
│   └── sitemap-proxy.js
└── tests/             ← Unit tests
```

### Local Development

1. Clone the repository
2. Open `site/index.html` in a browser
3. Run tests: `npm test`

### Self-Hosting

#### Website Only (no sitemap fetching)

Upload the `site/` folder to any web server. The URL paste feature works without any backend.

#### Full Deployment (with sitemap fetching)

The sitemap feature requires a CORS proxy:

1. Create a [Cloudflare account](https://cloudflare.com)
2. Go to **Workers & Pages** → **Create Worker**
3. Replace the code with contents of `worker/sitemap-proxy.js`
4. Update `ALLOWED_ORIGIN` in the worker to your domain
5. Click **Deploy**
6. Update `PROXY_URL` in `site/js/app.js` with your worker URL

## For Contributors

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

### Quick Start

1. Fork the repository
2. Create a feature branch
3. Make changes and run tests: `npm test`
4. Submit a Pull Request

## License

[MIT](LICENSE)
