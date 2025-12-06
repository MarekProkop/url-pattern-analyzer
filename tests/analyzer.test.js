const { test, describe } = require('node:test');
const assert = require('node:assert');
const UrlAnalyzer = require('../site/js/analyzer.js');

/**
 * Helper: Extract just the pattern strings from results
 */
function getPatterns(results) {
    return results.map(r => r.pattern).sort();
}

describe('UrlAnalyzer', () => {
    const analyzer = new UrlAnalyzer();

    describe('Basic functionality', () => {
        test('empty input returns empty array', () => {
            const result = analyzer.analyze([]);
            assert.deepStrictEqual(result, []);
        });

        test('whitespace-only input returns empty array', () => {
            const result = analyzer.analyze(['', '  ', '\t']);
            assert.deepStrictEqual(result, []);
        });

        test('invalid URLs are filtered out', () => {
            const result = analyzer.analyze(['not-a-url', 'https://example.com/valid']);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].pattern, 'https://example.com/valid');
        });

        test('duplicate URLs are deduplicated', () => {
            const result = analyzer.analyze([
                'https://example.com/page',
                'https://example.com/page',
                'https://example.com/page'
            ]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].count, 1);
        });
    });

    describe('Pattern masking - static vs dynamic', () => {
        test('single URL - no masking (static)', () => {
            const result = analyzer.analyze(['https://example.com/foo']);
            assert.deepStrictEqual(getPatterns(result), ['https://example.com/foo']);
        });

        test('multiple URLs with same path - no masking (static)', () => {
            const result = analyzer.analyze([
                'https://example.com/products',
                'https://example.com/products'
            ]);
            // Deduplicated to 1
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].pattern, 'https://example.com/products');
        });

        test('multiple URLs with different final segments - masking (dynamic)', () => {
            const result = analyzer.analyze([
                'https://example.com/products/123',
                'https://example.com/products/456',
                'https://example.com/products/789'
            ]);
            assert.deepStrictEqual(getPatterns(result), ['https://example.com/products/…']);
        });

        test('multiple URLs with different first segments - masking', () => {
            const result = analyzer.analyze([
                'https://example.com/products/123',
                'https://example.com/categories/abc'
            ]);
            assert.deepStrictEqual(getPatterns(result), ['https://example.com/…/…']);
        });

        test('simple single-segment paths should be masked', () => {
            const result = analyzer.analyze([
                'https://example.com/a',
                'https://example.com/b',
                'https://example.com/c'
            ]);
            assert.deepStrictEqual(getPatterns(result), ['https://example.com/…']);
        });

        test('mixed static and dynamic segments', () => {
            const result = analyzer.analyze([
                'https://example.com/blog/a',
                'https://example.com/blog/b',
                'https://example.com/about'
            ]);
            const patterns = getPatterns(result);
            // 'blog' and 'about' are at same position -> both masked to …
            // Result: https://example.com/…/… (for blog/a, blog/b) and https://example.com/… (for about)
            assert.ok(patterns.some(p => p.includes('…')));
        });

        test('static segment after dynamic segment', () => {
            const result = analyzer.analyze([
                'https://www.example.com/01/p/001',
                'https://www.example.com/02/p/002',
                'https://www.example.com/03/p/003',
                'https://www.example.com/04/p/004',
                'https://www.example.com/05/p/005'
            ]);
            assert.deepStrictEqual(getPatterns(result), ['https://www.example.com/…/p/…']);
        });
    });

    describe('Host handling', () => {
        test('tenant-like subdomains are masked', () => {
            const result = analyzer.analyze([
                'https://tenant1.app.com/dashboard',
                'https://tenant2.app.com/dashboard',
                'https://tenant3.app.com/dashboard'
            ]);
            assert.deepStrictEqual(getPatterns(result), ['https://….app.com/dashboard']);
        });

        test('meaningful subdomains like www and blog should NOT be masked', () => {
            const result = analyzer.analyze([
                'https://www.example.com/page',
                'https://www.example.com/about',
                'https://blog.example.com/post',
                'https://blog.example.com/archive'
            ]);
            const patterns = getPatterns(result);
            // www and blog are meaningful subdomains - they should stay separate
            assert.ok(patterns.some(p => p.includes('www.example.com')),
                'Should keep www subdomain: ' + JSON.stringify(patterns));
            assert.ok(patterns.some(p => p.includes('blog.example.com')),
                'Should keep blog subdomain: ' + JSON.stringify(patterns));
            assert.ok(!patterns.some(p => p.includes('….example.com')),
                'Should NOT mask to ….example.com: ' + JSON.stringify(patterns));
        });

        test('different domains create separate patterns', () => {
            const result = analyzer.analyze([
                'https://example.com/page',
                'https://other.com/page'
            ]);
            // Different domains are never masked - they create separate patterns
            assert.strictEqual(result.length, 2);
        });

        test('www vs non-www are treated as different host structures', () => {
            const result = analyzer.analyze([
                'https://example.com/page',
                'https://www.example.com/page'
            ]);
            // www.example.com has 3 host segments, example.com has 2
            // They have different structures, so they create separate patterns
            assert.strictEqual(result.length, 2);
        });
    });

    describe('Scheme handling', () => {
        test('http and https create separate patterns', () => {
            const result = analyzer.analyze([
                'http://example.com/page',
                'https://example.com/page'
            ]);
            // Different schemes are never masked - they create separate patterns
            assert.strictEqual(result.length, 2);
        });
    });

    describe('Result structure', () => {
        test('result contains pattern, count, and urls', () => {
            const result = analyzer.analyze([
                'https://example.com/products/123',
                'https://example.com/products/456'
            ]);
            assert.strictEqual(result.length, 1);
            assert.ok('pattern' in result[0]);
            assert.ok('count' in result[0]);
            assert.ok('urls' in result[0]);
            assert.strictEqual(result[0].count, 2);
            assert.strictEqual(result[0].urls.length, 2);
        });

        test('results are sorted by group frequency, then hierarchically', () => {
            const result = analyzer.analyze([
                'https://example.com/a',
                'https://example.com/a/1',
                'https://example.com/a/2',
                'https://example.com/b',
                'https://example.com/b/1',
                'https://example.com/b/2',
                'https://example.com/b/3',
                'https://example.com/b/4',
                'https://example.com/b/5',
                'https://example.com/c'
            ]);
            const patterns = result.map(r => r.pattern);
            // /b group has total 6 (1+5), /a group has total 3 (1+2), /c has 1
            // Expected order: /b group first (highest), then /a group, then /c
            assert.strictEqual(patterns[0], 'https://example.com/b');
            assert.strictEqual(patterns[1], 'https://example.com/b/…');
            assert.strictEqual(patterns[2], 'https://example.com/a');
            assert.strictEqual(patterns[3], 'https://example.com/a/…');
            assert.strictEqual(patterns[4], 'https://example.com/c');
        });
    });

    describe('Mixed structures at same level', () => {
        test('static segment after dynamic when mixed with other paths', () => {
            // This tests the /01/p/001 pattern when mixed with locale paths
            const result = analyzer.analyze([
                'https://www.example.com/en-us/home',
                'https://www.example.com/en-us/pricing',
                'https://www.example.com/fr-fr/home',
                'https://www.example.com/01/p/001',
                'https://www.example.com/02/p/002',
                'https://www.example.com/03/p/003'
            ]);
            const patterns = getPatterns(result);
            // Should have separate locale patterns AND the …/p/… pattern
            assert.ok(patterns.some(p => p.includes('/p/')),
                'Should preserve /p/ as static segment: ' + JSON.stringify(patterns));
            assert.ok(patterns.some(p => p === 'https://www.example.com/…/p/…'),
                'Should produce …/p/… pattern: ' + JSON.stringify(patterns));
        });

        test('route names vs IDs are distinguished by count', () => {
            // home/pricing appear multiple times (routes) while IDs appear once each
            const result = analyzer.analyze([
                'https://example.com/users/home',
                'https://example.com/products/home',
                'https://example.com/settings/home',
                'https://example.com/users/123',
                'https://example.com/products/456'
            ]);
            const patterns = getPatterns(result);
            // 'home' appears 3 times -> should be kept as route name
            // '123', '456' appear once -> should be masked
            assert.ok(patterns.some(p => p.includes('/home')),
                'Should preserve /home as route: ' + JSON.stringify(patterns));
        });
    });

    describe('Edge cases', () => {
        test('root path only', () => {
            const result = analyzer.analyze(['https://example.com/']);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].pattern, 'https://example.com/');
        });

        test('deep nested paths', () => {
            const result = analyzer.analyze([
                'https://example.com/a/b/c/d/1',
                'https://example.com/a/b/c/d/2'
            ]);
            assert.deepStrictEqual(getPatterns(result), ['https://example.com/a/b/c/d/…']);
        });

        test('paths with special characters', () => {
            const result = analyzer.analyze([
                'https://example.com/path%20with%20spaces',
                'https://example.com/path-with-dashes'
            ]);
            assert.strictEqual(result.length, 1);
        });
    });
});
