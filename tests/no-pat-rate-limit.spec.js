// @ts-check
const { test, expect } = require('@playwright/test');

// #38: without a PAT, GitHub allows 60 API calls an hour. Every load called
// fetchRepo() for each repo with 4 requests, so a second load within the hour
// ran out partway and rows showed "error 403", or 0 issues / 0 PRs when only
// the list calls were refused. fetchRepo() now makes 3 requests (PRs come from
// the /issues response, which already includes them), treats a 403/429 as
// rate-limited rather than empty, and falls back to the last data it saved.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
  await page.evaluate(() => { localStorage.removeItem(REPO_CACHE_KEY); S.pat = ''; S.currentUser = ''; });
}

const item = (login, extra = {}) => ({ user: { login, type: 'User' }, labels: [], ...extra });
const ISSUES = [
  item('someone', { pull_request: {} }), item('ScottKirvan', { pull_request: {} }),
  item('ScottKirvan', { labels: [{ name: 'bug' }] }),
];

// Installs a fetch stub. `refuse` lists URL suffixes that answer 403 (rate limited).
async function stubFetch(page, refuse = []) {
  await page.evaluate(({ ISSUES, refuse }) => {
    window.__urls = [];
    const headers = { get: h => ({ 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1800) })[h] ?? null };
    window.fetch = async (url) => {
      url = String(url);
      window.__urls.push(url);
      if (refuse.some(r => url.includes(r))) return { ok: false, status: 403, headers, json: async () => ({ message: 'API rate limit exceeded' }) };
      if (url.endsWith('/repos/ScottKirvan/Smokey')) return { ok: true, status: 200, headers, json: async () => ({ full_name: 'ScottKirvan/Smokey', pushed_at: '2026-11-01T00:00:00Z' }) };
      if (url.includes('/releases/latest')) return { ok: true, status: 200, headers, json: async () => ({ tag_name: 'v0.5.0', published_at: '2026-11-01T00:00:00Z' }) };
      if (url.includes('/issues')) return { ok: true, status: 200, headers, json: async () => ISSUES };
      return { ok: false, status: 404, headers, json: async () => ({}) };
    };
  }, { ISSUES, refuse });
}

test.describe('fetchRepo without a PAT', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('makes 3 requests per repo, counting PRs from the /issues response', async ({ page }) => {
    await stubFetch(page);
    const { d, urls } = await page.evaluate(async () => ({ d: await fetchRepo('ScottKirvan/Smokey', {}), urls: window.__urls }));
    expect(urls).toHaveLength(3);
    expect(urls.some(u => u.includes('/pulls'))).toBe(false);
    expect(d.open_prs).toBe(2);
    expect(d.external_prs).toBe(1);
    expect(d.open_issues).toBe(1);
    expect(d.issue_split).toEqual({ bug: 1, feat: 0, misc: 0 });
  });

  test('a rate-limited issue list is not reported as zero issues', async ({ page }) => {
    await stubFetch(page, ['/issues']);
    const d = await page.evaluate(() => fetchRepo('ScottKirvan/Smokey', {}));
    expect(d.error).toBe('rate');
    expect(d.open_issues).toBeUndefined();
  });

  test('when rate-limited, the last saved data is shown instead of an error', async ({ page }) => {
    await stubFetch(page);
    await page.evaluate(() => fetchRepo('ScottKirvan/Smokey', {}));
    await stubFetch(page, ['/repos/ScottKirvan/Smokey']);
    const d = await page.evaluate(() => fetchRepo('ScottKirvan/Smokey', {}));
    expect(d.error).toBeUndefined();
    expect(d.open_prs).toBe(2);
    expect(d.open_issues).toBe(1);
    expect(typeof d.stale_at).toBe('string');
  });
});

test.describe('rendering a rate-limited load', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('a rate-limited repo with nothing saved explains itself instead of "error 403"', async ({ page }) => {
    const text = await page.evaluate(() => {
      S.rateLimit = { limit: 60, remaining: 0, reset: Math.floor(Date.now() / 1000) + 1800 };
      const tb = document.createElement('tbody');
      tb.innerHTML = rowHTML({ full_name: 'ScottKirvan/Smokey', error: 'rate' });
      return tb.textContent.replace(/\s+/g, ' ').trim();
    });
    expect(text).toContain('GitHub rate limit reached');
    expect(text).toContain('add a PAT');
    expect(text).toMatch(/wait \d+m/);
    expect(text).not.toContain('403');
  });

  test('the summary says when it is showing saved data', async ({ page }) => {
    const summary = await page.evaluate(() => {
      S.data = [{ full_name: 'ScottKirvan/Smokey', pushed_at: '2026-11-01T00:00:00Z', open_prs: 2, external_prs: 1, open_issues: 1,
        external_issues: 0, issue_split: { bug: 1, feat: 0, misc: 0 }, latest_release: null, stale_at: new Date(Date.now() - 12 * 60000).toISOString() }];
      updateSummary(S.data);
      return document.getElementById('summaryBar').textContent;
    });
    expect(summary).toContain('rate limited: 1 repo from saved data');
  });
});
