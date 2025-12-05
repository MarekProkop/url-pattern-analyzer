/**
 * URL Pattern Analyzer Logic
 */

class UrlAnalyzer {
    constructor() {
        this.placeholder = '…';
    }

    /**
     * Main entry point.
     * @param {string[]} urls - List of absolute URLs.
     * @returns {Object[]} - List of pattern objects { pattern, count, urls }.
     */
    analyze(urls) {
        // 1. Preprocessing
        const uniqueUrls = [...new Set(urls.filter(u => u.trim().length > 0))];
        if (uniqueUrls.length === 0) return [];

        const parsedUrls = uniqueUrls.map(u => this.parseUrl(u)).filter(u => u !== null);

        // 2. Build Trie
        const root = this.createNode();

        for (const parsed of parsedUrls) {
            let currentNode = root;

            // Segments: Scheme -> Host -> Path
            // We treat them as a single sequence for the Trie
            const sequence = [
                { type: 'scheme', val: parsed.scheme },
                ...parsed.hostSegments.map(s => ({ type: 'host', val: s })),
                ...parsed.pathSegments.map(s => ({ type: 'path', val: s }))
            ];

            for (const seg of sequence) {
                const key = `${seg.type}:${seg.val}`;
                if (!currentNode.children[key]) {
                    currentNode.children[key] = this.createNode(seg.val, seg.type);
                }
                currentNode = currentNode.children[key];
                currentNode.count++;
            }
            currentNode.urls.push(parsed.original);
        }

        // 3. Pattern Extraction (Collapse Trie)
        const patternsMap = new Map(); // patternString -> { count, urls }

        this.collectPatterns([root], [], patternsMap);

        // 4. Convert Map to Array and Sort
        const patterns = Array.from(patternsMap.entries()).map(([pattern, data]) => ({
            pattern,
            count: data.urls.length,
            urls: data.urls
        }));

        patterns.sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern));

        return patterns;
    }

    createNode(value = null, type = null) {
        return { children: {}, count: 0, urls: [], value, type };
    }

    /**
     * Recursive traversal to collect patterns.
     * @param {Object[]} nodes - List of current Trie nodes to process together.
     * @param {Object[]} pathStack - Accumulated segments {val, type} for the pattern.
     * @param {Map} patternsMap - Output map.
     */
    collectPatterns(nodes, pathStack, patternsMap) {
        // 1. Handle Terminals (End of URL)
        const terminalUrls = [];
        for (const node of nodes) {
            if (node.urls.length > 0) {
                terminalUrls.push(...node.urls);
            }
        }
        if (terminalUrls.length > 0) {
            const patternStr = this.buildPatternString(pathStack);
            if (!patternsMap.has(patternStr)) {
                patternsMap.set(patternStr, { urls: [] });
            }
            patternsMap.get(patternStr).urls.push(...terminalUrls);
        }

        // 2. Collect all children from all nodes
        const nextSegments = new Map(); // key (type:value) -> Array of nodes

        for (const node of nodes) {
            for (const key in node.children) {
                const child = node.children[key];
                if (!nextSegments.has(key)) {
                    nextSegments.set(key, []);
                }
                nextSegments.get(key).push(child);
            }
        }

        if (nextSegments.size === 0) return;

        // 3. Group by "patternified" key
        const groups = new Map(); // groupKey (type:value OR type:…) -> Array of nodes

        for (const [key, childNodes] of nextSegments) {
            // Calculate total count for this specific segment value across all branches
            let totalCount = 0;
            for (const child of childNodes) {
                totalCount += child.count;
            }

            // Determine if we should mask
            const firstChild = childNodes[0];
            let groupVal = firstChild.value;

            if (totalCount === 1) {
                groupVal = this.placeholder;
            }

            const groupKey = `${firstChild.type}:${groupVal}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(...childNodes);
        }

        // 4. Recurse
        for (const [groupKey, childNodes] of groups) {
            const separatorIndex = groupKey.indexOf(':');
            const type = groupKey.substring(0, separatorIndex);
            const val = groupKey.substring(separatorIndex + 1);

            this.collectPatterns(childNodes, [...pathStack, { val, type }], patternsMap);
        }
    }

    buildPatternString(segments) {
        if (segments.length === 0) return '';

        let result = '';

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const nextSeg = segments[i + 1];

            result += seg.val;

            // Add delimiter based on current and next type
            if (seg.type === 'scheme') {
                result += '://';
            } else if (seg.type === 'host') {
                if (nextSeg && nextSeg.type === 'host') {
                    result += '.';
                } else if (nextSeg && nextSeg.type === 'path') {
                    result += '/';
                } else if (!nextSeg) {
                    result += '/';
                }
            } else if (seg.type === 'path') {
                if (nextSeg && nextSeg.type === 'path') {
                    result += '/';
                }
            }
        }

        return result;
    }

    /**
     * Parses a URL into segments.
     */
    parseUrl(urlStr) {
        try {
            const url = new URL(urlStr);
            const scheme = url.protocol.replace(':', '');

            const hostSegments = url.hostname.split('.');
            const pathSegments = url.pathname.split('/').filter(s => s.length > 0);

            return {
                original: urlStr,
                scheme,
                hostSegments,
                pathSegments
            };
        } catch (e) {
            return null;
        }
    }
}

window.UrlAnalyzer = UrlAnalyzer;
