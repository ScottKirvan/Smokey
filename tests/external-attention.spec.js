// @ts-check
const { test, expect } = require('@playwright/test');

// fetchRepo() counts open PRs and issues that need Scott's attention: anything
// not filed by him, ignoring bots (release-please and friends would otherwise
// keep repos flagged forever). The exception is an in-app bug report: BojuBot's
// report form files issues through a GitHub App (scott-kirvan-reports[bot])
// with the `user-report` label, and those must be flagged even though a bot
// filed them. The same goes for GitHubDHC's automated Obsidian-update check,
// which files issues as github-actions[bot] with the `obsidian-update` label.

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
      // /issues returns PRs too (items with a pull_request key), as GitHub does.
      if (url.includes('/issues')) return { ok: true, json: async () => issues.concat(prs.map(p => ({ ...p, pull_request: {} }))) };
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

  test('an automated Obsidian-update issue from GitHubDHC\'s workflow is flagged', async ({ page }) => {
    const d = await fetchWith(page, [issue('github-actions[bot]', 'Bot', ['obsidian-update'])]);
    expect(d.external_issues).toBe(1);
  });

  test('the attention badge\'s issue link doesn\'t hide issues github-actions filed, but the PR link still does', async ({ page }) => {
    const links = await page.evaluate(() => {
      S.currentUser = 'ScottKirvan';
      renderBadges([{ full_name: 'ScottKirvan/GitHubDHC', external_prs: 1, external_issues: 1 }]);
      return {
        issue: decodeURIComponent(document.querySelector('#issueBadges .shield').getAttribute('href')),
        pr: decodeURIComponent(document.querySelector('#prBadges .shield').getAttribute('href')),
      };
    });
    expect(links.issue).toContain('-author:ScottKirvan');
    expect(links.issue).not.toContain('github-actions');
    expect(links.pr).toContain('-author:github-actions[bot]');
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

// QuKi-Notes gets Dependabot PRs, which the bot filter hid. Bots in
// ATTENTION_BOTS count like people; other bots are still ignored.
test.describe('Dependabot and badge order', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('a Dependabot PR needs attention; other bot PRs still don\'t', async ({ page }) => {
    const d = await fetchWith(page, [], [
      { ...issue('dependabot[bot]', 'Bot'), created_at: '2026-11-10T00:00:00Z' },
      { ...issue('renovate[bot]', 'Bot'), created_at: '2026-11-11T00:00:00Z' },
    ]);
    expect(d.external_prs).toBe(1);
    expect(d.newest_ext_pr_at).toBe('2026-11-10T00:00:00Z');
  });

  test('records the newest outside PR and issue, ignoring ones that don\'t need attention', async ({ page }) => {
    const d = await fetchWith(page,
      [{ ...issue('someone', 'User'), created_at: '2026-11-01T00:00:00Z' }, { ...issue('someone', 'User'), created_at: '2026-11-05T00:00:00Z' },
       { ...issue('ScottKirvan', 'User'), created_at: '2026-11-09T00:00:00Z' }],
      [{ ...issue('someone', 'User'), created_at: '2026-11-03T00:00:00Z' }]);
    expect(d.newest_ext_issue_at).toBe('2026-11-05T00:00:00Z');
    expect(d.newest_ext_pr_at).toBe('2026-11-03T00:00:00Z');
  });

  test('each badge row puts the repo with the newest outside item on the left', async ({ page }) => {
    const order = await page.evaluate(() => {
      const repo = (name, prAt, issueAt) => ({ full_name: `ScottKirvan/${name}`, external_prs: prAt ? 1 : 0, external_issues: issueAt ? 1 : 0,
        newest_ext_pr_at: prAt, newest_ext_issue_at: issueAt });
      renderBadges([
        repo('Old', '2026-10-01T00:00:00Z', '2026-11-12T00:00:00Z'),
        repo('QuKi-Notes', '2026-11-13T00:00:00Z', null),
        repo('Mid', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'),
        { full_name: 'ScottKirvan/Cached', external_prs: 1, external_issues: 0 }, // saved before these dates existed
      ]);
      const names = sel => [...document.querySelectorAll(`${sel} .shield-name`)].map(e => e.textContent);
      return { prs: names('#prBadges'), issues: names('#issueBadges') };
    });
    expect(order.prs).toEqual(['QuKi-Notes', 'Mid', 'Old', 'Cached']);
    expect(order.issues).toEqual(['Old', 'Mid']);
  });
});
