const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const patternsList = document.getElementById('patternsList');
const patternCount = document.getElementById('patternCount');
const inputSection = document.getElementById('inputSection');
const collapsedInputSection = document.getElementById('collapsedInputSection');
const editInputBtn = document.getElementById('editInputBtn');
const urlCountSummary = document.getElementById('urlCountSummary');

// Sitemap UI elements
const urlsTab = document.getElementById('urlsTab');
const sitemapTab = document.getElementById('sitemapTab');
const urlsPanel = document.getElementById('urlsPanel');
const sitemapPanel = document.getElementById('sitemapPanel');
const sitemapUrlInput = document.getElementById('sitemapUrlInput');
const fetchSitemapBtn = document.getElementById('fetchSitemapBtn');
const sitemapStatus = document.getElementById('sitemapStatus');
const statusMessage = document.getElementById('statusMessage');
const errorList = document.getElementById('errorList');
const analyzeSitemapBtn = document.getElementById('analyzeSitemapBtn');

// Sitemap proxy URL (Cloudflare Worker)
const SITEMAP_PROXY_URL = 'https://sitemap-proxy.mprokop.workers.dev';

// Validate required DOM elements
if (!urlInput || !analyzeBtn || !resultsSection || !patternsList ||
    !patternCount || !inputSection || !collapsedInputSection ||
    !editInputBtn || !urlCountSummary) {
    throw new Error('Required DOM elements not found. Check HTML element IDs.');
}

const analyzer = new UrlAnalyzer();
let fetchedUrls = []; // Store URLs fetched from sitemap
let currentTab = 'urls';

analyzeBtn.addEventListener('click', () => {
    const text = urlInput.value;
    if (!text.trim()) return;

    // Show loading state
    const btnText = analyzeBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    btnText.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;

    // Use setTimeout to allow UI to update before processing
    setTimeout(() => {
        const urls = text.split('\n').filter(u => u.trim().length > 0);
        const patterns = analyzer.analyze(urls);

        renderResults(patterns);

        // Collapse Input
        inputSection.classList.add('hidden');
        collapsedInputSection.classList.remove('hidden');
        urlCountSummary.textContent = `${urls.length} URLs`;

        // Restore button state
        btnText.textContent = originalText;
        analyzeBtn.disabled = false;
    }, 10);
});

editInputBtn.addEventListener('click', () => {
    inputSection.classList.remove('hidden');
    collapsedInputSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    // Restore to the tab that was used
    switchTab(currentTab);
});

// Tab switching
urlsTab.addEventListener('click', () => switchTab('urls'));
sitemapTab.addEventListener('click', () => switchTab('sitemap'));

function switchTab(tab) {
    currentTab = tab;
    if (tab === 'urls') {
        urlsTab.classList.add('active');
        sitemapTab.classList.remove('active');
        urlsPanel.classList.remove('hidden');
        sitemapPanel.classList.add('hidden');
        urlInput.focus();
    } else {
        sitemapTab.classList.add('active');
        urlsTab.classList.remove('active');
        sitemapPanel.classList.remove('hidden');
        urlsPanel.classList.add('hidden');
        sitemapUrlInput.focus();
    }
}

// Focus input on load
urlInput.focus();

// Sitemap fetch handler
fetchSitemapBtn.addEventListener('click', async () => {
    let inputUrl = sitemapUrlInput.value.trim();

    if (!inputUrl) {
        updateSitemapStatus('error', 'Please enter a URL');
        return;
    }

    // Add protocol if missing
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
        inputUrl = 'https://' + inputUrl;
    }

    // Reset state
    fetchedUrls = [];
    analyzeSitemapBtn.disabled = true;
    fetchSitemapBtn.disabled = true;

    try {
        const fetcher = new SitemapFetcher(SITEMAP_PROXY_URL);
        let allErrors = [];

        // Determine sitemap URLs to fetch
        let sitemapUrls;
        if (fetcher.isSitemapUrl(inputUrl)) {
            sitemapUrls = [inputUrl];
            updateSitemapStatus('loading', 'Fetching sitemap...');
        } else {
            // Autodiscover from robots.txt
            updateSitemapStatus('loading', 'Discovering sitemaps from robots.txt...');
            const discovery = await fetcher.discoverSitemaps(inputUrl);
            sitemapUrls = discovery.sitemaps;

            if (discovery.fromRobots) {
                updateSitemapStatus('loading',
                    `Found ${sitemapUrls.length} sitemap(s) in robots.txt. Fetching...`
                );
            } else {
                updateSitemapStatus('loading', 'Trying default sitemap location...');
            }
        }

        // Fetch all sitemaps
        for (let i = 0; i < sitemapUrls.length; i++) {
            const sitemapUrl = sitemapUrls[i];
            const result = await fetcher.fetchSitemap(sitemapUrl, (progress) => {
                const prefix = sitemapUrls.length > 1
                    ? `Sitemap ${i + 1}/${sitemapUrls.length}: `
                    : '';
                updateSitemapStatus('loading',
                    `${prefix}Fetching ${progress.current} of ${progress.total}... (${fetchedUrls.length + progress.urls} URLs)`
                );
            });

            // Use concat to avoid stack overflow with large arrays
            fetchedUrls = fetchedUrls.concat(result.urls);
            allErrors = allErrors.concat(result.errors);
        }

        // Show final status
        if (allErrors.length > 0 && fetchedUrls.length > 0) {
            updateSitemapStatus('warning',
                `Found ${fetchedUrls.length} URLs. Some sitemaps failed:`,
                allErrors
            );
        } else if (allErrors.length > 0) {
            updateSitemapStatus('error',
                'Failed to fetch sitemap.',
                allErrors
            );
        } else {
            updateSitemapStatus('success', `Found ${fetchedUrls.length} URLs`);
        }

        analyzeSitemapBtn.disabled = fetchedUrls.length === 0;

    } catch (error) {
        updateSitemapStatus('error', `Error: ${error.message}`);
    } finally {
        fetchSitemapBtn.disabled = false;
    }
});

function updateSitemapStatus(type, message, errors = []) {
    sitemapStatus.classList.remove('hidden', 'loading', 'success', 'error', 'warning');
    sitemapStatus.classList.add(type);
    statusMessage.textContent = message;

    if (errors.length > 0) {
        errorList.classList.remove('hidden');
        errorList.innerHTML = errors.map(e =>
            `<li><code>${e.url}</code>: ${e.error.message}</li>`
        ).join('');
    } else {
        errorList.classList.add('hidden');
        errorList.innerHTML = '';
    }
}

// Sitemap analyze button handler
analyzeSitemapBtn.addEventListener('click', () => {
    if (fetchedUrls.length === 0) return;

    const btnText = analyzeSitemapBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    btnText.textContent = 'Analyzing...';
    analyzeSitemapBtn.disabled = true;

    setTimeout(() => {
        const patterns = analyzer.analyze(fetchedUrls);

        renderResults(patterns);

        // Collapse input
        inputSection.classList.add('hidden');
        collapsedInputSection.classList.remove('hidden');
        urlCountSummary.textContent = `${fetchedUrls.length} URLs (from sitemap)`;

        btnText.textContent = originalText;
        analyzeSitemapBtn.disabled = false;
    }, 10);
});

function renderResults(patterns) {
    patternsList.innerHTML = '';
    patternCount.textContent = patterns.length;
    resultsSection.classList.remove('hidden');

    if (patterns.length === 0) {
        patternsList.innerHTML = '<p class="no-results">No patterns found.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'results-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="col-pattern">Pattern</th>
            <th class="col-count">Count</th>
            <th class="col-actions"></th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    patterns.forEach(pattern => {
        const row = document.createElement('tr');
        row.className = 'pattern-row';
        if (pattern.depth > 0) {
            row.classList.add('nested');
            row.dataset.depth = pattern.depth;
        }

        const patternCell = document.createElement('td');
        patternCell.className = 'col-pattern';

        // Add indentation for nested patterns
        if (pattern.depth > 0) {
            const indent = document.createElement('span');
            indent.className = 'indent';
            indent.style.paddingLeft = (pattern.depth * 20) + 'px';
            indent.textContent = '└─ ';
            patternCell.appendChild(indent);
        }

        const code = document.createElement('code');
        code.textContent = pattern.pattern;
        patternCell.appendChild(code);

        const countCell = document.createElement('td');
        countCell.className = 'col-count';
        countCell.textContent = pattern.count;

        const actionsCell = document.createElement('td');
        actionsCell.className = 'col-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn-icon';
        toggleBtn.innerHTML = '<span class="icon-chevron">▼</span>';
        toggleBtn.title = 'Show URLs';
        toggleBtn.onclick = () => toggleDetails(row, pattern.urls, toggleBtn);
        actionsCell.appendChild(toggleBtn);

        row.appendChild(patternCell);
        row.appendChild(countCell);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    patternsList.appendChild(table);
}

function toggleDetails(row, urls, btn) {
    const nextRow = row.nextElementSibling;
    const icon = btn.querySelector('.icon-chevron');

    if (nextRow && nextRow.classList.contains('details-row')) {
        nextRow.remove();
        row.classList.remove('expanded');
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'details-row';

        const detailsCell = document.createElement('td');
        detailsCell.colSpan = 3;

        const container = document.createElement('div');
        container.className = 'url-list-container';

        const list = document.createElement('ul');
        const MAX_DISPLAY = 100;
        const displayUrls = urls.slice(0, MAX_DISPLAY);

        displayUrls.forEach(url => {
            const li = document.createElement('li');
            li.textContent = url;
            list.appendChild(li);
        });

        container.appendChild(list);

        if (urls.length > MAX_DISPLAY) {
            const more = document.createElement('div');
            more.className = 'more-urls';
            more.textContent = `...and ${urls.length - MAX_DISPLAY} more`;
            container.appendChild(more);
        }
        detailsCell.appendChild(container);
        detailsRow.appendChild(detailsCell);

        row.parentNode.insertBefore(detailsRow, row.nextSibling);
        row.classList.add('expanded');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
}
