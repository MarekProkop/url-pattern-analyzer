/**
 * Cloudflare Worker - Sitemap Fetcher
 *
 * Usage: ?url=https://example.com
 *
 * - If URL is a domain: fetches robots.txt, discovers sitemaps
 * - If URL is a sitemap: fetches it directly
 * - Returns JSON: { urls: [...], errors: [...], sitemapCount: N }
 */

export default {
  async fetch(request) {
    const url = new URL(request.url).searchParams.get('url');

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

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
          result.urls = result.urls.concat(r.urls);
        } else if (r.type === 'sitemapindex') {
          const childResults = await fetchChildSitemaps(r.sitemaps, concurrency);
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

async function fetchChildSitemaps(sitemapUrls, concurrency) {
  const result = { urls: [], errors: [], count: 0 };

  for (let i = 0; i < sitemapUrls.length; i += concurrency) {
    const batch = sitemapUrls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(fetchSitemap));

    for (const r of results) {
      if (r.error) {
        result.errors.push({ url: r.url, error: r.error });
      } else if (r.type === 'urlset') {
        result.count++;
        result.urls = result.urls.concat(r.urls);
      }
    }
  }

  return result;
}
