/**
 * Cloudflare Worker - Sitemap Fetcher
 *
 * Usage: ?url=https://example.com
 *
 * - If URL is a domain: fetches robots.txt, discovers sitemaps
 * - If URL is a sitemap: fetches it directly
 * - Returns JSON: { urls: [...], errors: [...], sitemapCount: N }
 *
 * IMPORTANT: If you're self-hosting this app, deploy your own worker
 * and update the ALLOWED_ORIGIN below to match your domain.
 */

// Configure this to your domain when deploying your own worker
const ALLOWED_ORIGIN = 'https://www.prokopsw.cz';

// Limits to prevent timeouts on very large sitemaps
const MAX_CHILD_SITEMAPS = 50;
const MAX_TOTAL_URLS = 300000;

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');

    // Check if the request is from an allowed origin
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Reject requests from unauthorized origins
    if (origin && origin !== ALLOWED_ORIGIN) {
      return jsonResponse({ error: 'Unauthorized origin' }, 403, corsHeaders);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url).searchParams.get('url');

    if (!url) {
      return jsonResponse({ error: 'Missing url parameter' }, 400, corsHeaders);
    }

    try {
      const result = await discoverAndFetch(url);
      return jsonResponse(result, 200, corsHeaders);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500, corsHeaders);
    }
  }
};

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

async function discoverAndFetch(inputUrl) {
  const result = { urls: [], errors: [], sitemapCount: 0 };

  let baseUrl;
  try {
    baseUrl = new URL(inputUrl);
  } catch {
    return { ...result, errors: [{ url: inputUrl, error: 'Invalid URL' }] };
  }

  // Check if it's already a sitemap URL
  const path = baseUrl.pathname.toLowerCase();
  const isSitemap = path.endsWith('.xml') || path.endsWith('.xml.gz') || path.includes('sitemap');

  const sitemapUrls = isSitemap
    ? [inputUrl]
    : await discoverFromRobots(baseUrl.origin);

  // Fetch all sitemaps
  const concurrency = 5;
  for (let i = 0; i < sitemapUrls.length; i += concurrency) {
    const batch = sitemapUrls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(fetchSitemap));

    for (const r of results) {
      if (r.error) {
        result.errors.push({ url: r.url, error: r.error });
      } else {
        result.sitemapCount++;
        if (r.type === 'urlset') {
          // Check URL limit
          const remaining = MAX_TOTAL_URLS - result.urls.length;
          if (remaining <= 0) {
            result.errors.push({
              url: 'limit',
              error: `URL limit reached (${MAX_TOTAL_URLS.toLocaleString()}). Some URLs were not collected.`
            });
            return result;
          }
          const urlsToAdd = r.urls.slice(0, remaining);
          result.urls = result.urls.concat(urlsToAdd);
        } else if (r.type === 'sitemapindex') {
          // Refuse if too many child sitemaps
          if (r.sitemaps.length > MAX_CHILD_SITEMAPS) {
            return {
              urls: [],
              errors: [{
                url: r.url,
                error: `Sitemap index contains ${r.sitemaps.length} sitemaps (limit: ${MAX_CHILD_SITEMAPS}). Use the "Paste URLs" tab instead.`
              }],
              sitemapCount: 0
            };
          }
          const childResults = await fetchChildSitemaps(r.sitemaps, concurrency, result.urls.length);
          result.urls = result.urls.concat(childResults.urls);
          result.errors = result.errors.concat(childResults.errors);
          result.sitemapCount += childResults.count;
        }
      }
    }
  }

  return result;
}

async function discoverFromRobots(origin) {
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': 'SitemapFetcher/1.0' }
    });

    if (!response.ok) {
      return [`${origin}/sitemap.xml`];
    }

    const content = await response.text();
    const sitemaps = [];

    for (const line of content.split('\n')) {
      const match = line.match(/^Sitemap:\s*(.+)/i);
      if (match) {
        sitemaps.push(match[1].trim());
      }
    }

    return sitemaps.length > 0 ? sitemaps : [`${origin}/sitemap.xml`];
  } catch {
    return [`${origin}/sitemap.xml`];
  }
}

async function fetchSitemap(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SitemapFetcher/1.0' }
    });

    if (!response.ok) {
      return { url, error: `HTTP ${response.status}` };
    }

    return parseSitemap(await response.text(), url);
  } catch (err) {
    return { url, error: err.message };
  }
}

function parseSitemap(xml, url) {
  if (xml.includes('<sitemapindex')) {
    const sitemaps = [];
    const regex = /<sitemap[^>]*>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      sitemaps.push(match[1].trim());
    }
    return { url, type: 'sitemapindex', sitemaps };
  }

  if (xml.includes('<urlset')) {
    const urls = [];
    const regex = /<url[^>]*>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }
    return { url, type: 'urlset', urls };
  }

  return { url, error: 'Not a valid sitemap' };
}

async function fetchChildSitemaps(sitemapUrls, concurrency, currentUrlCount = 0) {
  const result = { urls: [], errors: [], count: 0 };
  let totalUrls = currentUrlCount;
  let limitReached = false;

  for (let i = 0; i < sitemapUrls.length && !limitReached; i += concurrency) {
    const batch = sitemapUrls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(fetchSitemap));

    for (const r of results) {
      if (r.error) {
        result.errors.push({ url: r.url, error: r.error });
      } else if (r.type === 'urlset') {
        result.count++;
        // Check if adding these URLs would exceed limit
        const remaining = MAX_TOTAL_URLS - totalUrls;
        if (remaining <= 0) {
          result.errors.push({
            url: 'limit',
            error: `URL limit reached (${MAX_TOTAL_URLS.toLocaleString()}). Some URLs were not collected.`
          });
          limitReached = true;
          break;
        }
        // Add URLs up to the limit
        const urlsToAdd = r.urls.slice(0, remaining);
        result.urls = result.urls.concat(urlsToAdd);
        totalUrls += urlsToAdd.length;
      }
    }
  }

  return result;
}
