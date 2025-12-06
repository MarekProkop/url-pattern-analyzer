/**
 * SitemapFetcher - Fetches URLs from sitemaps via Cloudflare Worker
 *
 * The worker handles all the heavy lifting:
 * - robots.txt discovery
 * - Sitemap index traversal
 * - XML parsing
 *
 * This client just makes a single request and receives all URLs.
 */
class SitemapFetcher {
    constructor(proxyUrl) {
        this.proxyUrl = proxyUrl;
    }

    /**
     * Fetch all URLs from a domain or sitemap URL
     * @param {string} inputUrl - Domain (example.com) or sitemap URL
     * @returns {Promise<{urls: string[], errors: Array, sitemapCount: number}>}
     */
    async fetchUrls(inputUrl) {
        // Normalize URL - add protocol if missing
        let url = inputUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const requestUrl = `${this.proxyUrl}?url=${encodeURIComponent(url)}`;

        try {
            const response = await fetch(requestUrl);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();

            // Normalize error format for UI
            if (result.errors) {
                result.errors = result.errors.map(e => ({
                    url: e.url,
                    error: { type: 'remote', message: e.error }
                }));
            }

            return {
                urls: result.urls || [],
                errors: result.errors || [],
                sitemapCount: result.sitemapCount || 0
            };
        } catch (error) {
            return {
                urls: [],
                errors: [{ url: inputUrl, error: { type: 'network', message: error.message } }],
                sitemapCount: 0
            };
        }
    }
}

// Browser export
if (typeof window !== 'undefined') {
    window.SitemapFetcher = SitemapFetcher;
}
