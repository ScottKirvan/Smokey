// @ts-check
const { test, expect } = require('@playwright/test');

// The issue trend chart thickens each line where activity happened, sized by
// how many issues of that category were opened plus closed that day. A day
// that opens and closes the same number of issues leaves the count flat, so
// the swell is the only thing showing that the day was busy.

const issue = (c, x, t) => ({ c, x, t });

// The page runs its own load() on startup, which fetches from GitHub and
// re-renders the issue chart in the background — racing whatever a test
// renders. Block the network and wait for that run to finish first.
async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading);
}

test.describe('buildIssueSeries', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('counts opens plus closes per category per day as churn', async ({ page }) => {
    const cache = {
      'o/a': {
        1: issue('2026-09-01T10:00:00Z', null, 'bug'),
        2: issue('2026-09-01T11:00:00Z', '2026-09-01T12:00:00Z', 'bug'),
        3: issue('2026-09-01T13:00:00Z', null, 'feat'),
      },
    };
    const s = await page.evaluate((cache) => buildIssueSeries(cache, new Set(['o/a'])), cache);
    expect(s.days).toEqual(['2026-09-01']);
    expect(s.bugs).toEqual([{ count: 1, churn: 3 }]);
    expect(s.feats).toEqual([{ count: 1, churn: 1 }]);
    expect(s.misc).toEqual([{ count: 0, churn: 0 }]);
  });

  test('a day that opens and closes equally keeps the count flat but records the churn', async ({ page }) => {
    const cache = { 'o/a': {} };
    for (let i = 0; i < 10; i++) {
      cache['o/a'][i] = issue(`2026-09-02T0${i}:00:00Z`, `2026-09-02T0${i}:30:00Z`, 'bug');
    }
    cache['o/a'][99] = issue('2026-09-01T00:00:00Z', null, 'bug');
    const s = await page.evaluate((cache) => buildIssueSeries(cache, new Set(['o/a'])), cache);
    expect(s.days).toEqual(['2026-09-01', '2026-09-02']);
    expect(s.bugs[1]).toEqual({ count: 1, churn: 20 });
  });

  test('ignores repos that are not monitored and returns null when nothing is left', async ({ page }) => {
    const cache = { 'o/gone': { 1: issue('2026-09-01T00:00:00Z', null, 'bug') } };
    const s = await page.evaluate((cache) => buildIssueSeries(cache, new Set(['o/a'])), cache);
    expect(s).toBeNull();
  });
});

test.describe('dayWidth', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('is widest for the most recent day and shrinks as days get older', async ({ page }) => {
    const [today, aWeekAgo, aYearAgo] = await page.evaluate(() => [
      dayWidth(0, 365, 1000),
      dayWidth(7, 365, 1000),
      dayWidth(364, 365, 1000),
    ]);
    expect(today).toBeGreaterThan(aWeekAgo);
    expect(aWeekAgo).toBeGreaterThan(aYearAgo);
  });
});

test.describe('churnStroke', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('a single event is visibly thicker than the 1.5px line', async ({ page }) => {
    expect(await page.evaluate(() => churnStroke(1))).toBeGreaterThanOrEqual(4);
  });

  test('grows with churn and is capped at 12px when there is room', async ({ page }) => {
    const [a, b, c, cap] = await page.evaluate(() => [churnStroke(2), churnStroke(5), churnStroke(10), churnStroke(500)]);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(cap).toBe(12);
  });

  test('is capped by the available day width, not just the 12px ceiling', async ({ page }) => {
    const [narrow, wide] = await page.evaluate(() => [churnStroke(500, 3), churnStroke(500, 20)]);
    expect(narrow).toBe(3);
    expect(wide).toBe(12); // still bounded by the absolute ceiling even with room to spare
  });
});

test.describe('renderIssueChart', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('draws one swell per category-day with activity, sized by churn and day width', async ({ page }) => {
    const series = {
      days: ['2026-01-01', '2026-09-01'],
      bugs:  [{ count: 2, churn: 2 }, { count: 2, churn: 20 }],
      feats: [{ count: 1, churn: 1 }, { count: 1, churn: 0 }],
      misc:  [{ count: 0, churn: 0 }, { count: 0, churn: 0 }],
      total: 13,
    };
    // Render and compute the expected per-day cap in the same evaluate()
    // call, sharing one Date.now() — doing it in two round-trips drifts by
    // the IPC gap between them, enough to flip the sub-pixel log-axis math.
    const { widths, expected } = await page.evaluate((series) => {
      const now = Date.now();
      renderIssueChart(series);
      const widths = [...document.querySelectorAll('#iBugBeads path')]
        .map(p => +p.getAttribute('stroke-width'));

      const W = 1000;
      const maxDays = Math.max(1, (now - new Date(series.days[0] + 'T00:00:00Z').getTime()) / 86400000);
      const ago = d => Math.max(0, (now - new Date(d + 'T12:00:00Z').getTime()) / 86400000);
      const expected = [
        churnStroke(2,  dayWidth(ago(series.days[0]), maxDays, W)),
        churnStroke(20, dayWidth(ago(series.days[1]), maxDays, W)),
      ];
      return { widths, expected };
    }, series);

    await expect(page.locator('#issueChartSvg')).toBeVisible();
    await expect(page.locator('#iBugBeads path')).toHaveCount(2);
    await expect(page.locator('#iFeatBeads path')).toHaveCount(1);
    await expect(page.locator('#iMiscBeads path')).toHaveCount(0);
    expect(widths).toEqual(expected);
  });

  // A flat day's swell is a near-zero-length stroke, so getBoundingClientRect()
  // (which SVG reports geometry-only, no stroke/cap) is a single point — hit-
  // test the painted stroke instead, offset from that point by just under
  // half the swell's own stroke-width so the probe lands inside the round-
  // cap's bulge but outside the 1.5px line underneath (same x, narrower).
  test('a flat busy day still paints a swell around the line', async ({ page }) => {
    const series = {
      days: ['2026-01-01', '2026-09-01'],
      bugs:  [{ count: 1, churn: 1 }, { count: 1, churn: 20 }],
      feats: [{ count: 0, churn: 0 }, { count: 0, churn: 0 }],
      misc:  [{ count: 0, churn: 0 }, { count: 0, churn: 0 }],
      total: 11,
    };
    await page.evaluate((series) => renderIssueChart(series), series);
    const hit = await page.evaluate(() => {
      const bead = document.querySelectorAll('#iBugBeads path')[1];
      const r = bead.getBoundingClientRect();
      const offset = +bead.getAttribute('stroke-width') / 2 - 1;
      const el = document.elementFromPoint(r.left, r.top - offset);
      return el === bead;
    });
    expect(hit).toBe(true);
  });

  test('shows a message and hides the chart when there is no data', async ({ page }) => {
    await page.evaluate(() => renderIssueChart({ days: [], bugs: [], feats: [], misc: [], total: 0 }));
    await expect(page.locator('#issueMsg')).toHaveText('No issue data yet.');
    await expect(page.locator('#issueChartSvg')).toBeHidden();
  });
});
