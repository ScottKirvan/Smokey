// @ts-check
const { test, expect } = require('@playwright/test');

// fetchRepo() counts open PRs and issues that need Scott's attention: anything
// not filed by him, ignoring bots (release-please and friends would otherwise
// keep repos flagged forever). The exception is an in-app bug report: BojuBot's
// report form files issues through a GitHub App (scott-kirvan-reports[bot])
// with the `user-report` label, and those must be flagged even though a bot
// filed them.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
}

const issue = (login, type, labels = []) => ({ user: { login, type }, labels: labels.map(name => ({ name })) });

async function fetchWith(page, issues, prs = []) {
  return page.evaluate(async ({ issues, prs }) => {
    S.currentUser = 'ScottKirvan';
    window.fetch = async (url) => {
      url = String(url);
      if (url.endsWith('/repos/ScottKirvan/BojuBot')) return { ok: true, headers: { get: () => null }, json: async () => ({ full_name: 'ScottKirvan/BojuBot', pushed_at: '2026-10-28T00:00:00Z' }) };
      if (url.includes('/issues')) return { ok: true, json: async () => issues };
      if (url.includes('/pulls')) return { ok: true, json: async () => prs };
      return { ok: false, status: 404 };
    };
    return fetchRepo('ScottKirvan/BojuBot', {});
  }, { issues, prs });
}

test.describe('external attention counts', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('an in-app bug report filed by the report relay app is flagged', async ({ page }) => {
    const d = await fetchWith(page, [issue('scott-kirvan-reports[bot]', 'Bot', ['bug', 'user-report'])]);
    expect(d.external_issues).toBe(1);
  });

  test('other bot-filed issues are still ignored', async ({ page }) => {
    const d = await fetchWith(page, [issue('renovate[bot]', 'Bot', ['dependencies'])]);
    expect(d.external_issues).toBe(0);
  });

  test('issues from other people are flagged and Scott\'s own are not', async ({ page }) => {
    const d = await fetchWith(page, [issue('someone', 'User'), issue('ScottKirvan', 'User', ['bug'])]);
    expect(d.external_issues).toBe(1);
  });

  test('the repo gets the attention badge and the red row edge', async ({ page }) => {
    const d = await fetchWith(page, [issue('scott-kirvan-reports[bot]', 'Bot', ['bug', 'user-report'])]);
    const rendered = await page.evaluate((d) => {
      S.data = [d];
      renderAll();
      return {
        badges: [...document.querySelectorAll('#issueBadges .shield')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
        rowFlagged: document.querySelector('#tbody tr').classList.contains('has-ext'),
      };
    }, d);
    expect(rendered.badges).toEqual(['BojuBot 1']);
    expect(rendered.rowFlagged).toBe(true);
  });
});
