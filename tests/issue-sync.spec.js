// @ts-check
const { test, expect } = require('@playwright/test');

// loadIssueHistory() fetches each repo's full issue history once, then only
// asks for issues updated since that repo's sync timestamp. If a fetch fails
// partway (rate limit, network error, 404) and the timestamp still advances,
// the pages that were never fetched are skipped forever — a silent, permanent
// gap in the chart. A repo's timestamp may only advance on a complete fetch.

const ISSUE = (n) => ({ number: n, created_at: '2026-09-01T00:00:00Z', closed_at: null, labels: [] });

// The page runs its own load() on startup, which replaces S.data and runs
// loadIssueHistory() in the background — a test's call would return early
// (issueLoading) or have its stubs used by that run. Block the network and
// wait for that run to finish first.
async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading);
}

async function run(page, responses, { repos = ['o/a'], sync = {} } = {}) {
  return page.evaluate(async ({ responses, repos, sync }) => {
    localStorage.setItem('rw_sync_v1', JSON.stringify(sync));
    localStorage.removeItem('rw_issues_v1');
    S.data = repos.map(full_name => ({ full_name }));
    const calls = [];
    window.fetch = async (url) => {
      calls.push(String(url));
      const key = Object.keys(responses).find(k => String(url).includes(k));
      const r = responses[key] ?? { status: 200, body: [] };
      if (r.throw) throw new Error('network down');
      return { ok: r.status === 200, status: r.status, json: async () => r.body };
    };
    await loadIssueHistory();
    return {
      calls,
      sync: JSON.parse(localStorage.getItem('rw_sync_v1') || '{}'),
      cache: JSON.parse(localStorage.getItem('rw_issues_v1') || '{}'),
    };
  }, { responses, repos, sync });
}

test.describe('loadIssueHistory sync bookkeeping', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('a complete fetch records the repo as synced', async ({ page }) => {
    const r = await run(page, {
      'o/a/issues?state=all&per_page=100&page=1': { status: 200, body: [ISSUE(1)] },
    });
    expect(r.sync['o/a']).toBeTruthy();
    expect(Object.keys(r.cache['o/a'])).toEqual(['1']);
  });

  test('a rate-limited fetch does not record the repo as synced', async ({ page }) => {
    const r = await run(page, {
      'o/a/issues?state=all&per_page=100&page=1': { status: 200, body: [ISSUE(1)] },
      'o/a/issues?state=all&per_page=100&page=2': { status: 403, body: {} },
    });
    expect(r.sync['o/a']).toBeUndefined();
  });

  // A second repo that syncs fine makes the load save its results, which is
  // the normal case — the failing repo must not be swept up in that save.
  test('a network error does not record the repo as synced', async ({ page }) => {
    const r = await run(page, {
      'o/b/issues?state=all&per_page=100&page=1': { status: 200, body: [ISSUE(7)] },
      'o/a/issues?state=all&per_page=100&page=1': { throw: true },
    }, { repos: ['o/b', 'o/a'] });
    expect(r.sync['o/b']).toBeTruthy();
    expect(r.sync['o/a']).toBeUndefined();
  });

  test('a failed incremental fetch keeps the previous timestamp', async ({ page }) => {
    const prev = '2026-09-01T00:00:00.000Z';
    const r = await run(page, {
      'o/b/issues?state=all&per_page=100&page=1': { status: 200, body: [ISSUE(7)] },
      'o/a/issues': { status: 500, body: {} },
    }, { repos: ['o/b', 'o/a'], sync: { 'o/a': prev } });
    expect(r.sync['o/b']).toBeTruthy();
    expect(r.sync['o/a']).toBe(prev);
  });

  test('a rate limit stops the sync instead of spending calls on the remaining repos', async ({ page }) => {
    const r = await run(page, {
      'o/a/issues': { status: 403, body: {} },
    }, { repos: ['o/a', 'o/b'] });
    expect(r.calls.some(u => u.includes('o/b/'))).toBe(false);
  });
});
