// @ts-check
const { test, expect } = require('@playwright/test');

// "Last push" used GitHub's pushed_at, which any push to any branch updates.
// The weekly Starline workflow (starlines branch, every repo) and Smokey's
// traffic logger (traffic-log branch) made every repo look recently pushed,
// hiding neglected ones. With a PAT, Last push now comes from the repo
// activity feed: the newest push or merge on any branch not in the ignore
// list (a Setting, default "starlines, traffic-log"). Without a PAT it stays
// pushed_at, so a no-PAT load spends no extra API calls.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
}

const act = (ref, timestamp, activity_type = 'push', login = 'ScottKirvan') =>
  ({ ref: `refs/heads/${ref}`, timestamp, activity_type, actor: { login, type: login.endsWith('[bot]') ? 'Bot' : 'User' } });

test.describe('lastPushFromActivity', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('skips ignored branches and branch deletions; release-please and feature branches count', async ({ page }) => {
    const out = await page.evaluate(({ list }) => lastPushFromActivity(list, ['starlines', 'traffic-log']), { list: [
      act('starlines', '2026-11-09T00:00:00Z', 'push', 'github-actions[bot]'),
      act('traffic-log', '2026-11-08T00:00:00Z', 'push', 'github-actions[bot]'),
      act('old-feature', '2026-11-07T00:00:00Z', 'branch_deletion'),
      act('release-please--branches--main', '2026-11-06T00:00:00Z', 'push', 'github-actions[bot]'),
      act('main', '2026-11-01T00:00:00Z'),
    ] });
    expect(out).toEqual({ at: '2026-11-06T00:00:00Z', beyond: false });
  });

  test('a feature branch push counts, not just main', async ({ page }) => {
    const out = await page.evaluate(({ list }) => lastPushFromActivity(list, ['starlines']), { list: [
      act('starlines', '2026-11-09T00:00:00Z', 'push', 'github-actions[bot]'),
      act('fix/thing', '2026-11-05T00:00:00Z'),
      act('main', '2026-10-01T00:00:00Z'),
    ] });
    expect(out.at).toBe('2026-11-05T00:00:00Z');
  });

  test('when every entry is on an ignored branch, it reports the oldest one as a lower bound', async ({ page }) => {
    const out = await page.evaluate(({ list }) => lastPushFromActivity(list, ['starlines']), { list: [
      act('starlines', '2026-11-09T00:00:00Z'), act('starlines', '2026-11-02T00:00:00Z'),
    ] });
    expect(out).toEqual({ at: '2026-11-02T00:00:00Z', beyond: true });
    expect(await page.evaluate(() => lastPushFromActivity([], ['starlines']))).toBeNull();
  });
});

test.describe('Last push in a load', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  async function runLoad(page, pat) {
    return page.evaluate(async ({ pat, activity }) => {
      S.pat = pat; S.repos = ['ScottKirvan/Smokey']; S.showFeed = false; S.showNotifs = false;
      S.ignoreBranches = ['starlines', 'traffic-log'];
      const urls = [];
      window.fetch = async (url) => {
        url = String(url); urls.push(url);
        const headers = { get: () => null };
        if (url.endsWith('/user')) return { ok: true, headers, json: async () => ({ login: 'ScottKirvan' }) };
        if (url.endsWith('/repos/ScottKirvan/Smokey')) return { ok: true, status: 200, headers, json: async () => ({ full_name: 'ScottKirvan/Smokey', pushed_at: '2026-11-09T00:00:00Z' }) };
        if (url.includes('/activity')) return { ok: true, status: 200, headers, json: async () => activity };
        if (url.includes('/issues')) return { ok: true, status: 200, headers, json: async () => [] };
        if (url.includes('/actions/runs')) return { ok: true, status: 200, headers, json: async () => ({ workflow_runs: [] }) };
        return { ok: false, status: 404, headers, json: async () => ({}), text: async () => '' };
      };
      await load();
      return { pushed: S.data[0].pushed_at, activityCalls: urls.filter(u => u.includes('/activity')) };
    }, { pat, activity: [
      act('starlines', '2026-11-09T00:00:00Z', 'push', 'github-actions[bot]'),
      act('main', '2026-09-01T00:00:00Z'),
    ] });
  }

  test('with a PAT, a Starline push no longer counts as the last push', async ({ page }) => {
    const out = await runLoad(page, 'ghp_x');
    expect(out.activityCalls).toEqual(['https://api.github.com/repos/ScottKirvan/Smokey/activity?per_page=100']);
    expect(out.pushed).toBe('2026-09-01T00:00:00Z');
  });

  test('without a PAT, nothing changes: pushed_at, and no activity call', async ({ page }) => {
    const out = await runLoad(page, '');
    expect(out.activityCalls).toEqual([]);
    expect(out.pushed).toBe('2026-11-09T00:00:00Z');
  });
});

test.describe('ignore list setting', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('defaults to starlines and traffic-log, and is saved from Settings', async ({ page }) => {
    expect(await page.evaluate(() => S.ignoreBranches)).toEqual(['starlines', 'traffic-log']);
    await page.evaluate(() => openConfig());
    await expect(page.locator('#ignoreBranchesInput')).toHaveValue('starlines, traffic-log');
    await page.locator('#ignoreBranchesInput').fill('starlines,  gh-pages ,');
    await page.evaluate(() => saveConfig());
    expect(await page.evaluate(() => [S.ignoreBranches, localStorage.getItem('rw_ignore_branches')]))
      .toEqual([['starlines', 'gh-pages'], 'starlines, gh-pages']);
    await gotoQuiet(page);
    expect(await page.evaluate(() => S.ignoreBranches)).toEqual(['starlines', 'gh-pages']);
  });
});
