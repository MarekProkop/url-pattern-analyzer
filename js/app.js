const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const patternsList = document.getElementById('patternsList');
const patternCount = document.getElementById('patternCount');
const inputSection = document.getElementById('inputSection');
const collapsedInputSection = document.getElementById('collapsedInputSection');
const editInputBtn = document.getElementById('editInputBtn');
const urlCountSummary = document.getElementById('urlCountSummary');

// Validate required DOM elements
if (!urlInput || !analyzeBtn || !resultsSection || !patternsList ||
    !patternCount || !inputSection || !collapsedInputSection ||
    !editInputBtn || !urlCountSummary) {
    throw new Error('Required DOM elements not found. Check HTML element IDs.');
}

const analyzer = new UrlAnalyzer();

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
