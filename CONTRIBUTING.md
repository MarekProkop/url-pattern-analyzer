# Contributing to URL Pattern Analyzer

Thank you for your interest in contributing!

## How to Contribute

### Reporting Bugs

Open an issue with:
- Clear, descriptive title
- Steps to reproduce
- Expected vs actual behavior

### Suggesting Features

Open an issue with:
- Description of the feature
- The problem it solves

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests: `npm test`
5. Commit and push
6. Open a Pull Request

## Development Setup

1. Clone the repository
2. Open `site/index.html` in a browser
3. Run tests with `npm test` (Node.js 18+)

### Self-Hosting with Sitemap Feature

1. Deploy `worker/sitemap-proxy.js` to Cloudflare Workers
2. Update `ALLOWED_ORIGIN` in the worker to your domain
3. Update `PROXY_URL` in `site/js/app.js` to your worker URL

## Code Style

- 2-space indentation
- Single quotes for strings
- Comments for complex logic

## Testing

```bash
npm test
```
