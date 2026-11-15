// @ts-check
const { test, expect } = require('@playwright/test');

// The PRs column shows a rocket when one of the repo's open PRs is a
// release-please release PR, linking to it. release-please labels its open
// PRs `autorelease: pending` (`autorelease: tagged` once merged), and its body
// says it was generated with Release Please. fetchRepo() finds it in the
// /issues response it already fetches, so it costs no extra API calls.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
}

const RP_BODY = ':robot: I have created a release *beep* *boop*\n---\nThis PR was generated with [Release Please](https://github.com/googleapis/release-please).';
const pr = (n, extra = {}) => ({
  number: n, title: `PR ${n}`, html_url: `https://github.com/ScottKirvan/Smokey/pull/${n}`,
  user: { login: 'ScottKirvan', type: 'User' }, labels: [], body: '', pull_request: {}, ...extra,
});

async function fetchWith(page, items) {
  return page.evaluate(async (items) => {
    S.currentUser = 'ScottKirvan';
    window.fetch = async (url) => {
      url = String(url);
      if (url.endsWith('/repos/ScottKirvan/Smokey')) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ full_name: 'ScottKirvan/Smokey' }) };
      if (url.includes('/issues')) return { ok: true, status: 200, json: async () => items };
      return { ok: false, status: 404 };
    };
    return fetchRepo('ScottKirvan/Smokey', {});
  }, items);
}

test.describe('release-please PR detection', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('finds the PR labelled autorelease: pending', async ({ page }) => {
    const d = await fetchWith(page, [
      pr(40),
      pr(41, { title: 'chore(main): release 0.7.0', user: { login: 'github-actions[bot]', type: 'Bot' }, labels: [{ name: 'autorelease: pending' }] }),
    ]);
    expect(d.release_pr).toEqual({ number: 41, title: 'chore(main): release 0.7.0', url: 'https://github.com/ScottKirvan/Smokey/pull/41' });
  });

  test('finds it by its body when the label is missing', async ({ page }) => {
    const d = await fetchWith(page, [pr(42, { title: 'chore: release 1.0.0', user: { login: 'github-actions[bot]', type: 'Bot' }, body: RP_BODY })]);
    expect(d.release_pr?.number).toBe(42);
  });

  test('ordinary PRs, issues and a tagged (already released) label don\'t count', async ({ page }) => {
    const d = await fetchWith(page, [
      pr(43),
      { ...pr(44, { labels: [{ name: 'autorelease: pending' }] }), pull_request: undefined },
      pr(45, { labels: [{ name: 'autorelease: tagged' }] }),
    ]);
    expect(d.release_pr).toBeNull();
  });
});

test.describe('rocket in the PRs column', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  const row = (release_pr) => ({ full_name: 'ScottKirvan/Smokey', pushed_at: '2026-11-14T00:00:00Z', open_prs: 2, external_prs: 0,
    open_issues: 0, external_issues: 0, issue_split: { bug: 0, feat: 0, misc: 0 }, latest_release: null, release_pr });

  test('shows a rocket, not a link, with the release PR\'s title next to the count', async ({ page }) => {
    const cell = await page.evaluate((d) => {
      S.data = [d]; renderAll();
      const td = document.querySelector('#tbody tr').children[2];
      const rocket = td.querySelector('.release-pr');
      return { count: td.querySelector('.cnt-link').textContent, tag: rocket?.tagName, inLink: !!rocket?.closest('a'), title: rocket?.getAttribute('title'), svg: !!rocket?.querySelector('svg') };
    }, row({ number: 41, title: 'chore(main): release 0.7.0', url: 'https://github.com/ScottKirvan/Smokey/pull/41' }));
    expect(cell).toEqual({ count: '2', tag: 'SPAN', inLink: false, title: 'Release PR open: chore(main): release 0.7.0', svg: true });
  });

  test('no release PR, no rocket', async ({ page }) => {
    const n = await page.evaluate((d) => { S.data = [d]; renderAll(); return document.querySelectorAll('#tbody .release-pr').length; }, row(null));
    expect(n).toBe(0);
  });
});
