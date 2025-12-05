/**
 * SitemapFetcher - Fetches and parses XML sitemaps via a proxy
 */
class SitemapFetcher {
    constructor(proxyUrl) {
        this.proxyUrl = proxyUrl;
        this.parser = new DOMParser();
        this.NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    }

    /**
     * Main entry point - fetch URLs from a sitemap URL
     * @param {string} sitemapUrl - URL of the sitemap to fetch
     * @param {function} onProgress - Progress callback: {current, total, urls, errors}
     * @returns {Promise<{urls: string[], errors: Array}>}
     */
    async fetchSitemap(sitemapUrl, onProgress = () => {}) {
        const result = { urls: [], errors: [] };

        try {
            const xml = await this.fetchXml(sitemapUrl);
            const parsed = this.parseXml(xml, sitemapUrl);

            if (parsed.type === 'urlset') {
                result.urls = parsed.urls;
                onProgress({ current: 1, total: 1, urls: result.urls.length, errors: [] });
            } else if (parsed.type === 'sitemapindex') {
                await this.fetchSitemapIndex(parsed.sitemaps, result, onProgress);
            }
        } catch (error) {
            result.errors.push({ url: sitemapUrl, error: this.classifyError(error) });
        }

        return result;
    }

    /**
     * Fetch multiple sitemaps from a sitemap index
     */
    async fetchSitemapIndex(sitemapUrls, result, onProgress) {
        const total = sitemapUrls.length;
        const concurrency = 3;
        let current = 0;

        // Process in batches
        for (let i = 0; i < sitemapUrls.length; i += concurrency) {
            const batch = sitemapUrls.slice(i, i + concurrency);
            const promises = batch.map(async (url) => {
                try {
                    const xml = await this.fetchXml(url);
                    const parsed = this.parseXml(xml, url);
                    if (parsed.type === 'urlset') {
                        result.urls.push(...parsed.urls);
                    }
                    // Note: Nested indexes not supported to prevent infinite recursion
                } catch (error) {
                    result.errors.push({ url, error: this.classifyError(error) });
                }
                current++;
                onProgress({ current, total, urls: result.urls.length, errors: result.errors });
            });
            await Promise.all(promises);
        }
    }

    /**
     * Fetch XML content via the proxy
     */
    async fetchXml(url) {
        const proxyUrl = `${this.proxyUrl}?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            // Try to parse error JSON from proxy
            try {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            } catch (e) {
                if (e.message.includes('HTTP')) throw e;
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }

        return await response.text();
    }

    /**
     * Parse XML content and detect type (urlset or sitemapindex)
     */
    parseXml(xmlContent, baseUrl = '') {
        const doc = this.parser.parseFromString(xmlContent, 'text/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid XML: ' + parseError.textContent.slice(0, 100));
        }

        // Detect type: urlset or sitemapindex
        const urlset = doc.getElementsByTagNameNS(this.NS, 'urlset')[0]
            || doc.getElementsByTagName('urlset')[0];
        const sitemapindex = doc.getElementsByTagNameNS(this.NS, 'sitemapindex')[0]
            || doc.getElementsByTagName('sitemapindex')[0];

        if (urlset) {
            return { type: 'urlset', urls: this.extractUrls(doc) };
        } else if (sitemapindex) {
            return { type: 'sitemapindex', sitemaps: this.extractSitemapUrls(doc, baseUrl) };
        } else {
            throw new Error('Not a valid sitemap: missing urlset or sitemapindex element');
        }
    }

    /**
     * Extract URLs from <url><loc> elements
     */
    extractUrls(doc) {
        const locs = doc.getElementsByTagNameNS(this.NS, 'loc');
        const fallbackLocs = locs.length === 0 ? doc.getElementsByTagName('loc') : locs;

        const urls = [];
        for (const loc of fallbackLocs) {
            const url = loc.textContent?.trim();
            if (url) urls.push(url);
        }
        return urls;
    }

    /**
     * Extract sitemap URLs from <sitemap><loc> elements in a sitemap index
     */
    extractSitemapUrls(doc, baseUrl) {
        const sitemaps = doc.getElementsByTagNameNS(this.NS, 'sitemap');
        const fallbackSitemaps = sitemaps.length === 0 ? doc.getElementsByTagName('sitemap') : sitemaps;

        const urls = [];
        for (const sitemap of fallbackSitemaps) {
            const loc = sitemap.getElementsByTagNameNS(this.NS, 'loc')[0]
                || sitemap.getElementsByTagName('loc')[0];
            if (loc?.textContent) {
                let url = loc.textContent.trim();
                // Resolve relative URLs
                if (baseUrl && !url.startsWith('http')) {
                    url = new URL(url, baseUrl).href;
                }
                urls.push(url);
            }
        }
        return urls;
    }

    /**
     * Classify error type for better UX
     */
    classifyError(error) {
        const msg = error.message || '';

        if (error.name === 'TypeError' || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
            return { type: 'network', message: 'Network error - check your connection', recoverable: true };
        }
        if (msg.includes('404')) {
            return { type: 'not_found', message: 'Sitemap not found (404)', recoverable: false };
        }
        if (msg.includes('Invalid XML')) {
            return { type: 'parse', message: msg, recoverable: false };
        }
        return { type: 'unknown', message: msg || 'Unknown error', recoverable: true };
    }
}

// Browser export
if (typeof window !== 'undefined') {
    window.SitemapFetcher = SitemapFetcher;
}
