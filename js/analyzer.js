/**
 * URL Pattern Analyzer Logic
 */

class UrlAnalyzer {
    constructor() {
        this.placeholder = '…';
        // Only mask subdomains if there are this many or fewer distinct values
        // This prevents merging different sites (shop, blog, api) but allows
        // merging tenant variations (tenant1, tenant2, tenant3)
        this.hostMaskThreshold = 3;
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

            // Segments: Scheme -> Domain -> Subdomain -> Path
            // Domain first so URLs are grouped by domain, then subdomains can be masked within each domain
            // e.g., "shop.example.com" -> domain:"example.com", subdomain:"shop"
            const hostSegs = parsed.hostSegments;
            const hasSubdomain = hostSegs.length > 2;

            const sequence = [
                { type: 'scheme', val: parsed.scheme },
                // Base domain (last 2 segments) - marked as 'domain' so it's never masked
                { type: 'domain', val: hostSegs.slice(-2).join('.') },
                // If there's a subdomain, mark it separately for potential masking
                ...(hasSubdomain ? [{ type: 'subdomain', val: hostSegs.slice(0, -2).join('.') }] : []),
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

        this.collectPatterns(root, [], patternsMap);

        // 4. Convert Map to Array and Sort
        const patterns = Array.from(patternsMap.entries()).map(([pattern, data]) => ({
            pattern,
            count: data.urls.length,
            urls: data.urls
        }));

        // Hierarchical sort: groups by frequency, hierarchy within groups
        // 1. Build parent-child relationships and calculate group totals
        const patternMap = new Map(patterns.map(p => [p.pattern, p]));
        const groupTotals = new Map(); // root pattern -> total count
        const roots = new Map(); // pattern -> its root pattern

        // Sort alphabetically first to process parents before children
        patterns.sort((a, b) => a.pattern.localeCompare(b.pattern));

        for (const p of patterns) {
            // Find parent: longest pattern that is prefix + '/'
            let parent = null;
            for (const other of patterns) {
                if (other.pattern !== p.pattern &&
                    p.pattern.startsWith(other.pattern) &&
                    p.pattern[other.pattern.length] === '/') {
                    if (!parent || other.pattern.length > parent.pattern.length) {
                        parent = other;
                    }
                }
            }

            if (parent) {
                // Inherit root from parent
                roots.set(p.pattern, roots.get(parent.pattern));
            } else {
                // This is a root
                roots.set(p.pattern, p.pattern);
            }

            // Add count to group total
            const root = roots.get(p.pattern);
            groupTotals.set(root, (groupTotals.get(root) || 0) + p.count);
        }

        // 2. Calculate depth for each pattern (for UI indentation)
        const depths = new Map();
        for (const p of patterns) {
            let depth = 0;
            let current = p.pattern;
            // Count ancestors
            for (const other of patterns) {
                if (other.pattern !== current &&
                    current.startsWith(other.pattern) &&
                    current[other.pattern.length] === '/') {
                    depth++;
                }
            }
            depths.set(p.pattern, depth);
        }

        // 3. Sort: group total (desc), then parent before child, then alphabetical
        patterns.sort((a, b) => {
            const aRoot = roots.get(a.pattern);
            const bRoot = roots.get(b.pattern);
            const aTotal = groupTotals.get(aRoot);
            const bTotal = groupTotals.get(bRoot);

            // Different groups: sort by group total descending
            if (aRoot !== bRoot) {
                if (aTotal !== bTotal) return bTotal - aTotal;
                return aRoot.localeCompare(bRoot);
            }

            // Same group: parent before child
            if (b.pattern.startsWith(a.pattern) && b.pattern[a.pattern.length] === '/') {
                return -1;
            }
            if (a.pattern.startsWith(b.pattern) && a.pattern[b.pattern.length] === '/') {
                return 1;
            }

            // Same group, same level: alphabetical
            return a.pattern.localeCompare(b.pattern);
        });

        // 4. Add depth to each pattern object
        for (const p of patterns) {
            p.depth = depths.get(p.pattern);
        }

        return patterns;
    }

    createNode(value = null, type = null) {
        return { children: {}, count: 0, urls: [], value, type };
    }

    /**
     * Recursive traversal to collect patterns.
     * Processes nodes and merges branches when they share a masked parent.
     * @param {Object} node - Current Trie node.
     * @param {Object[]} pathStack - Accumulated segments {val, type} for the pattern.
     * @param {Map} patternsMap - Output map.
     */
    collectPatterns(node, pathStack, patternsMap) {
        // 1. Handle Terminals (End of URL)
        if (node.urls.length > 0) {
            const patternStr = this.buildPatternString(pathStack);
            if (!patternsMap.has(patternStr)) {
                patternsMap.set(patternStr, { urls: [] });
            }
            patternsMap.get(patternStr).urls.push(...node.urls);
        }

        // 2. Group children by type
        const childrenByType = new Map(); // type -> [children]
        for (const key in node.children) {
            const child = node.children[key];
            if (!childrenByType.has(child.type)) {
                childrenByType.set(child.type, []);
            }
            childrenByType.get(child.type).push(child);
        }

        // 3. Process each type group
        for (const [type, children] of childrenByType) {
            // Only mask 'subdomain' and 'path' types
            // 'scheme' and 'domain' are never masked
            const canMask = type === 'subdomain' || type === 'path';

            if (children.length === 1) {
                // Single child -> keep literal
                const child = children[0];
                this.collectPatterns(
                    child,
                    [...pathStack, { val: child.value, type: child.type }],
                    patternsMap
                );
            } else if (!canMask) {
                // Multiple children but can't mask (scheme/domain) -> process each separately
                for (const child of children) {
                    this.collectPatterns(
                        child,
                        [...pathStack, { val: child.value, type: child.type }],
                        patternsMap
                    );
                }
            } else if (type === 'subdomain') {
                // Subdomains: mask only if few distinct values (tenant variations)
                if (children.length <= this.hostMaskThreshold) {
                    const mergedNode = this.mergeNodes(children);
                    this.collectPatterns(
                        mergedNode,
                        [...pathStack, { val: this.placeholder, type }],
                        patternsMap
                    );
                } else {
                    for (const child of children) {
                        this.collectPatterns(
                            child,
                            [...pathStack, { val: child.value, type: child.type }],
                            patternsMap
                        );
                    }
                }
            } else if (type === 'path') {
                // Paths: split into unique (count=1) and repeated (count>1)
                // Unique values are likely IDs/slugs -> mask and merge
                // Repeated values are likely route names -> keep separate
                const uniqueChildren = children.filter(c => c.count === 1);
                const repeatedChildren = children.filter(c => c.count > 1);

                // Process repeated children separately (route names)
                for (const child of repeatedChildren) {
                    this.collectPatterns(
                        child,
                        [...pathStack, { val: child.value, type: child.type }],
                        patternsMap
                    );
                }

                // Mask and merge unique children (IDs/slugs)
                if (uniqueChildren.length > 1) {
                    const mergedNode = this.mergeNodes(uniqueChildren);
                    this.collectPatterns(
                        mergedNode,
                        [...pathStack, { val: this.placeholder, type }],
                        patternsMap
                    );
                } else if (uniqueChildren.length === 1) {
                    const child = uniqueChildren[0];
                    this.collectPatterns(
                        child,
                        [...pathStack, { val: child.value, type: child.type }],
                        patternsMap
                    );
                }
            }
        }
    }

    /**
     * Merge multiple nodes into a single virtual node.
     * Combines their children and URLs.
     * If all nodes have the same value, keep it; otherwise use placeholder.
     */
    mergeNodes(nodes) {
        // Check if all nodes have the same value
        const values = new Set(nodes.map(n => n.value));
        const mergedValue = values.size === 1 ? nodes[0].value : this.placeholder;

        const merged = {
            children: {},
            urls: [],
            value: mergedValue,
            type: nodes[0].type
        };

        for (const node of nodes) {
            // Collect terminal URLs
            merged.urls.push(...node.urls);

            // Merge children by their key (type:value)
            for (const key in node.children) {
                const child = node.children[key];
                if (!merged.children[key]) {
                    // First time seeing this child key - clone it
                    merged.children[key] = {
                        children: { ...child.children },
                        urls: [...child.urls],
                        value: child.value,
                        type: child.type,
                        count: child.count
                    };
                } else {
                    // Already have this child key - merge into it
                    merged.children[key].urls.push(...child.urls);
                    merged.children[key].count += child.count;
                    // Recursively merge grandchildren
                    for (const grandKey in child.children) {
                        if (!merged.children[key].children[grandKey]) {
                            merged.children[key].children[grandKey] = child.children[grandKey];
                        } else {
                            // Need to deep merge - use recursive call
                            const mergedGrandchild = this.mergeNodes([
                                merged.children[key].children[grandKey],
                                child.children[grandKey]
                            ]);
                            merged.children[key].children[grandKey] = mergedGrandchild;
                        }
                    }
                }
            }
        }

        return merged;
    }

    buildPatternString(segments) {
        if (segments.length === 0) return '';

        // Separate segments by type
        const scheme = segments.find(s => s.type === 'scheme');
        const subdomain = segments.find(s => s.type === 'subdomain');
        const domain = segments.find(s => s.type === 'domain');
        const pathSegments = segments.filter(s => s.type === 'path');

        // Build the host part
        let host = '';
        if (subdomain) {
            host = subdomain.val + '.';
        }
        if (domain) {
            host += domain.val;
        }

        // Build the URL pattern
        let result = scheme ? scheme.val + '://' : '';
        result += host;
        result += '/';
        if (pathSegments.length > 0) {
            result += pathSegments.map(s => s.val).join('/');
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

// Browser
if (typeof window !== 'undefined') {
    window.UrlAnalyzer = UrlAnalyzer;
}
// Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UrlAnalyzer;
}
