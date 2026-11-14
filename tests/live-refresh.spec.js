// @ts-check
const { test, expect } = require('@playwright/test');

// The repo table used to refresh only on a reload. Without a server Smokey
// can't receive webhooks, so it refreshes itself instead:
//   - when the page becomes visible and its data is stale (2 min with a PAT,
//     15 min without, to protect the 60-calls-an-hour limit);
//   - with a PAT, when a repo's own event feed shows a push, PR, issue,
//     release or branch change since that row was fetched (polled every
//     minute with ETags, so an unchanged feed costs no rate limit);
//   - with a PAT, a 10-minute backstop (CI status isn't in the event feeds).
// A background refresh updates rows in place: no skeleton, no sweep replay.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
}

// Two repos in S.data; fetch is stubbed and every URL recorded.
async function setup(page, { pat = 'ghp_x', ageMin = 0, events = {} } = {}) {
  await page.evaluate(({ pat, ageMin, events }) => {
    S.pat = pat; S.currentUser = 'ScottKirvan'; S.showFeed = false; S.showNotifs = false;
    S.repos = ['ScottKirvan/Smokey', 'ScottKirvan/BojuBot'];
    const fetchedAt = new Date(Date.now() - ageMin * 60000).toISOString();
    S.data = S.repos.map(r => ({ full_name: r, pushed_at: '2026-11-01T00:00:00Z', open_prs: 0, external_prs: 0,
      open_issues: 0, external_issues: 0, issue_split: { bug: 0, feat: 0, misc: 0 }, latest_release: null, fetched_at: fetchedAt }));
    S.loadedAt = new Date(fetchedAt);
    renderAll();
    window.__urls = []; window.__sweeps = 0; window.__reqHeaders = [];
    const realSweep = playIssueSweep;
    window.playIssueSweep = () => { window.__sweeps++; };
    window.fetch = async (url, opts) => {
      url = String(url); window.__urls.push(url); window.__reqHeaders.push((opts && opts.headers) || {});
      const hdr = (extra = {}) => ({ get: h => extra[h] ?? null });
      const m = url.match(/repos\/(ScottKirvan\/[^/?]+)\/events/);
      if (m) {
        const ev = events[m[1]];
        if (ev === 304) return { ok: false, status: 304, headers: hdr(), json: async () => [] };
        return { ok: true, status: 200, headers: hdr({ ETag: `"etag-${m[1]}"` }), json: async () => ev || [] };
      }
      const repo = url.match(/repos\/(ScottKirvan\/[^/?]+)$/);
      if (repo) return { ok: true, status: 200, headers: hdr(), json: async () => ({ full_name: repo[1], pushed_at: '2026-11-14T00:00:00Z' }) };
      if (url.includes('/issues?state=open')) return { ok: true, status: 200, headers: hdr(), json: async () => [{ user: { login: 'someone', type: 'User' }, labels: [] }] };
      if (url.includes('/actions/runs')) return { ok: true, status: 200, headers: hdr(), json: async () => ({ workflow_runs: [] }) };
      if (url.includes('/activity')) return { ok: true, status: 200, headers: hdr(), json: async () => [] };
      return { ok: false, status: 404, headers: hdr(), json: async () => ({}) };
    };
  }, { pat, ageMin, events });
}
const repoFetches = page => page.evaluate(() => window.__urls.filter(u => /repos\/ScottKirvan\/[^/?]+$/.test(u)));
const setVisible = (page, visible) => page.evaluate(v => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'visible' : 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}, visible);

test.describe('refresh when the page becomes visible', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('with a PAT, data older than 2 minutes refreshes in place, without the skeleton or a sweep', async ({ page }) => {
    await setup(page, { ageMin: 3 });
    const skeletonSeen = page.evaluate(() => new Promise(res => {
      const obs = new MutationObserver(() => { if (document.querySelector('#tbody .skel')) { obs.disconnect(); res(true); } });
      obs.observe(document.getElementById('tbody'), { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); res(false); }, 1500);
    }));
    await setVisible(page, true);
    await expect.poll(() => repoFetches(page)).toEqual(['https://api.github.com/repos/ScottKirvan/Smokey', 'https://api.github.com/repos/ScottKirvan/BojuBot']);
    await expect.poll(() => page.evaluate(() => S.data[0].open_issues)).toBe(1);
    expect(await skeletonSeen).toBe(false);
    expect(await page.evaluate(() => window.__sweeps)).toBe(0);
  });

  test('fresh data is left alone', async ({ page }) => {
    await setup(page, { ageMin: 1 });
    await setVisible(page, true);
    await page.waitForTimeout(300);
    expect(await repoFetches(page)).toEqual([]);
  });

  test('without a PAT the threshold is 15 minutes', async ({ page }) => {
    await setup(page, { pat: '', ageMin: 10 });
    await setVisible(page, true);
    await page.waitForTimeout(300);
    expect(await repoFetches(page)).toEqual([]);
    await setup(page, { pat: '', ageMin: 16 });
    await setVisible(page, true);
    await expect.poll(() => repoFetches(page)).toHaveLength(2);
  });

  test('becoming hidden does nothing', async ({ page }) => {
    await setup(page, { ageMin: 30 });
    await setVisible(page, false);
    await page.waitForTimeout(300);
    expect(await repoFetches(page)).toEqual([]);
  });
});

test.describe('per-repo event polling (PAT only)', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  const ev = (type, minsAgo) => ({ type, created_at: new Date(Date.now() - minsAgo * 60000).toISOString() });

  test('a new PR on one repo re-fetches just that row', async ({ page }) => {
    await setup(page, { ageMin: 5, events: { 'ScottKirvan/Smokey': [ev('PullRequestEvent', 1)], 'ScottKirvan/BojuBot': [ev('PushEvent', 30)] } });
    await page.evaluate(() => pollRepoEvents());
    await expect.poll(() => repoFetches(page)).toEqual(['https://api.github.com/repos/ScottKirvan/Smokey']);
    await expect.poll(() => page.evaluate(() => S.data[0].open_issues)).toBe(1);
    expect(await page.evaluate(() => S.data[1].open_issues)).toBe(0);
    expect(await page.evaluate(() => window.__sweeps)).toBe(0);
  });

  test('events that don\'t change the table, or that predate the row, are ignored', async ({ page }) => {
    await setup(page, { ageMin: 5, events: { 'ScottKirvan/Smokey': [ev('WatchEvent', 1), ev('IssueCommentEvent', 1)], 'ScottKirvan/BojuBot': [ev('IssuesEvent', 10)] } });
    await page.evaluate(() => pollRepoEvents());
    await page.waitForTimeout(300);
    expect(await repoFetches(page)).toEqual([]);
  });

  test('the next poll sends each repo\'s ETag, and a 304 refreshes nothing', async ({ page }) => {
    await setup(page, { ageMin: 5, events: { 'ScottKirvan/Smokey': [], 'ScottKirvan/BojuBot': [] } });
    await page.evaluate(() => pollRepoEvents());
    await page.evaluate(() => {
      window.__reqHeaders = []; window.__urls = [];
    });
    await page.evaluate(() => pollRepoEvents());
    const sent = await page.evaluate(() => window.__reqHeaders.map(h => h['If-None-Match']));
    expect(sent).toEqual(['"etag-ScottKirvan/Smokey"', '"etag-ScottKirvan/BojuBot"']);
  });

  test('doesn\'t poll without a PAT, or while the page is hidden', async ({ page }) => {
    await setup(page, { pat: '', ageMin: 5 });
    await page.evaluate(() => pollRepoEvents());
    await setup(page, { ageMin: 5 });
    await setVisible(page, false);
    await page.evaluate(() => pollRepoEvents());
    expect(await page.evaluate(() => window.__urls.filter(u => u.includes('/events')))).toEqual([]);
  });
});

test.describe('10-minute backstop (PAT only)', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('refreshes visible data older than 10 minutes, with a PAT only', async ({ page }) => {
    await setup(page, { ageMin: 8 });
    await page.evaluate(() => backstopTick());
    await page.waitForTimeout(300);
    expect(await repoFetches(page)).toEqual([]);

    await setup(page, { pat: '', ageMin: 11 });
    await page.evaluate(() => backstopTick());
    await page.waitForTimeout(300);
    expect(await repoFetches(page)).toEqual([]);

    await setup(page, { ageMin: 11 });
    await page.evaluate(() => backstopTick());
    await expect.poll(() => repoFetches(page)).toHaveLength(2);
  });
});
