// @ts-check
const { test, expect } = require('@playwright/test');

// The repo table's Issues column shows open issues split bugs / features /
// misc ("10/8/2"), colored like the issue trend chart's categories. The split
// uses the same label rule as the chart: `bug` → bug, `enhancement` → feat,
// anything else → misc.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading);
}

const issue = (labels, extra = {}) => ({ labels: labels.map(name => ({ name })), user: { login: 'someone' }, ...extra });

test.describe('issueCategory', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('bug beats enhancement, enhancement beats everything else', async ({ page }) => {
    const cats = await page.evaluate(() => [
      issueCategory(['bug']),
      issueCategory(['enhancement']),
      issueCategory(['bug', 'enhancement']),
      issueCategory(['question', 'docs']),
      issueCategory([]),
    ]);
    expect(cats).toEqual(['bug', 'feat', 'bug', 'misc', 'misc']);
  });
});

test.describe('fetchRepo splits open issues by category', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('counts bugs, features and misc separately, skipping pull requests', async ({ page }) => {
    const issues = [
      issue(['bug']), issue(['bug', 'enhancement']), issue(['bug']),
      issue(['enhancement']), issue(['enhancement', 'help wanted']),
      issue(['question']), issue([]),
      issue(['bug'], { pull_request: {} }), // a PR in the issues feed: not counted
    ];
    const d = await page.evaluate(async (issues) => {
      window.fetch = async (url) => {
        url = String(url);
        if (url.endsWith('/repos/o/r')) return { ok: true, headers: { get: () => null }, json: async () => ({ full_name: 'o/r', pushed_at: '2026-01-01T00:00:00Z' }) };
        if (url.includes('/issues')) return { ok: true, json: async () => issues };
        if (url.includes('/pulls')) return { ok: true, json: async () => [] };
        return { ok: false, status: 404 };
      };
      return fetchRepo('o/r', {});
    }, issues);
    expect(d.issue_split).toEqual({ bug: 3, feat: 2, misc: 2 });
    expect(d.open_issues).toBe(7);
  });
});

test.describe('Issues column rendering', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  const repo = {
    full_name: 'o/r', pushed_at: '2026-01-01T00:00:00Z',
    open_prs: 0, external_prs: 0, open_issues: 18, external_issues: 0,
    issue_split: { bug: 10, feat: 8, misc: 0 }, latest_release: null,
  };

  test('shows bugs/features/misc, each linked to its filtered issue list and colored like the chart', async ({ page }) => {
    const parts = await page.evaluate((repo) => {
      const td = document.createElement('tbody');
      td.innerHTML = rowHTML(repo);
      return [...td.querySelectorAll('.issue-split a')].map(a => ({
        text: a.textContent, href: a.getAttribute('href'), cls: a.className,
      }));
    }, repo);
    expect(parts.map(p => p.text)).toEqual(['10', '8', '0']);
    expect(parts[0].href).toBe('https://github.com/o/r/issues?q=' + encodeURIComponent('is:issue is:open label:bug'));
    expect(parts[1].href).toBe('https://github.com/o/r/issues?q=' + encodeURIComponent('is:issue is:open label:enhancement -label:bug'));
    expect(parts[2].href).toBe('https://github.com/o/r/issues?q=' + encodeURIComponent('is:issue is:open -label:bug -label:enhancement'));
    expect(parts.map(p => p.cls)).toEqual(['ic-bug', 'ic-feat', 'ic-misc zero']); // zeros are dimmed
  });

  test('the numbers use the chart\'s core colors', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const colors = await page.evaluate((repo) => {
      document.getElementById('tbody').innerHTML = rowHTML({ ...repo, issue_split: { bug: 1, feat: 1, misc: 1 } });
      const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const resolve = c => { probe.style.color = c; return getComputedStyle(probe).color; };
      const got = [...document.querySelectorAll('#tbody .issue-split a')].map(a => getComputedStyle(a).color);
      return { got, want: ['--bug-core', '--feat-core', '--misc-core'].map(v => resolve(css(v))) };
    }, repo);
    expect(colors.got).toEqual(colors.want);
  });

  test('sorting by the Issues column still uses the total', async ({ page }) => {
    const order = await page.evaluate(() => {
      S.sortBy = 'issues'; S.sortDir = 'desc';
      return sortData([
        { full_name: 'a/few',  open_issues: 3,  issue_split: { bug: 3, feat: 0, misc: 0 } },
        { full_name: 'a/many', open_issues: 12, issue_split: { bug: 0, feat: 2, misc: 10 } },
      ]).map(d => d.full_name);
    });
    expect(order).toEqual(['a/many', 'a/few']);
  });
});
