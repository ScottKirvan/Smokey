// @ts-check
const { test, expect } = require('@playwright/test');

// The issue trend chart has no connecting line between days. Each day with
// activity gets its own candle: a rectangle centered on y0, the day's
// running open-issue count (the same position a connecting line would sit
// at). The candle fades from the category color to white exactly at y0,
// then back to color — white marks where "the line" is; color above/below
// shows how many issues opened (up) vs closed (down) that day, via a
// linear (not sqrt) length. This isn't a standard chart type (not OHLC
// candlesticks, not a diverging bar chart) — it's a one-off visualization
// built to show both "where the count is" and "how much happened" in one
// mark per day.

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

  test('tracks opens and closes separately per category per day, alongside the running count', async ({ page }) => {
    const cache = {
      'o/a': {
        1: issue('2026-09-01T10:00:00Z', null, 'bug'),                        // opens only
        2: issue('2026-09-01T11:00:00Z', '2026-09-01T12:00:00Z', 'bug'),      // opens + closes same day
        3: issue('2026-09-01T13:00:00Z', null, 'feat'),
      },
    };
    const s = await page.evaluate((cache) => buildIssueSeries(cache, new Set(['o/a'])), cache);
    expect(s.days).toEqual(['2026-09-01']);
    expect(s.bugs).toEqual([{ count: 1, opens: 2, closes: 1 }]);
    expect(s.feats).toEqual([{ count: 1, opens: 1, closes: 0 }]);
    expect(s.misc).toEqual([{ count: 0, opens: 0, closes: 0 }]);
  });

  test('a day that opens and closes equally keeps the count flat but records both counts', async ({ page }) => {
    const cache = { 'o/a': {} };
    for (let i = 0; i < 10; i++) {
      cache['o/a'][i] = issue(`2026-09-02T0${i}:00:00Z`, `2026-09-02T0${i}:30:00Z`, 'bug');
    }
    cache['o/a'][99] = issue('2026-09-01T00:00:00Z', null, 'bug');
    const s = await page.evaluate((cache) => buildIssueSeries(cache, new Set(['o/a'])), cache);
    expect(s.days).toEqual(['2026-09-01', '2026-09-02']);
    expect(s.bugs[1]).toEqual({ count: 1, opens: 10, closes: 10 });
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

test.describe('heatLen', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('scales linearly, not by square root', async ({ page }) => {
    const [one, two, four] = await page.evaluate(() => [
      heatLen(1, 4, 100), heatLen(2, 4, 100), heatLen(4, 4, 100),
    ]);
    expect(two).toBeCloseTo(one * 2, 5);
    expect(four).toBeCloseTo(one * 4, 5);
  });

  test('reaches the full length at maxVal and is 0 at n=0', async ({ page }) => {
    const [full, zero] = await page.evaluate(() => [heatLen(10, 10, 50), heatLen(0, 10, 50)]);
    expect(full).toBe(50);
    expect(zero).toBe(0);
  });
});

test.describe('renderIssueChart', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('draws a candle only for category-days with opens or closes activity', async ({ page }) => {
    const series = {
      days: ['2026-01-01', '2026-09-01'],
      bugs:  [{ count: 2, opens: 2, closes: 0 }, { count: 4, opens: 3, closes: 1 }],
      feats: [{ count: 1, opens: 1, closes: 0 }, { count: 1, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 13,
    };
    await page.evaluate((series) => renderIssueChart(series), series);

    await expect(page.locator('#issueChartSvg')).toBeVisible();
    await expect(page.locator('#iBugBeads rect')).toHaveCount(2);
    await expect(page.locator('#iFeatBeads rect')).toHaveCount(1); // only the first day has activity
    await expect(page.locator('#iMiscBeads rect')).toHaveCount(0);
  });

  test('an opens-only day puts the white stop at the bottom (the bar extends purely upward from y0)', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 1, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const stops = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelector('#iBugBeads linearGradient').querySelectorAll('stop')]
        .map(s => s.getAttribute('offset'));
    }, series);
    expect(stops).toEqual(['0', '1.000', '1']);
  });

  test('a closes-only day puts the white stop at the top (the bar extends purely downward from y0)', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 3, opens: 0, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const stops = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelector('#iBugBeads linearGradient').querySelectorAll('stop')]
        .map(s => s.getAttribute('offset'));
    }, series);
    expect(stops).toEqual(['0', '0.000', '1']);
  });

  test('equal opens and closes center the white stop in the middle of the bar', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 3, opens: 4, closes: 4 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const stop = await page.evaluate((series) => {
      renderIssueChart(series);
      return document.querySelector('#iBugBeads linearGradient').querySelectorAll('stop')[1].getAttribute('offset');
    }, series);
    expect(stop).toBe('0.500');
  });

  test('bar length scales linearly with opens/closes, not by square root', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 2, opens: 2, closes: 0 }], // half the max
      feats: [{ count: 1, opens: 4, closes: 0 }], // the max — sets maxVal
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 2,
    };
    const { bugHeight, featHeight } = await page.evaluate((series) => {
      renderIssueChart(series);
      return {
        bugHeight:  +document.querySelector('#iBugBeads rect').getAttribute('height'),
        featHeight: +document.querySelector('#iFeatBeads rect').getAttribute('height'),
      };
    }, series);
    // opens=2 against a maxVal of 4 should be exactly half the length of
    // opens=4 — sqrt scaling would instead give ~70% (sqrt(2)/sqrt(4)).
    expect(bugHeight).toBeCloseTo(featHeight / 2, 1);
  });

  test('candle width is capped by the day\'s available plot slot, independent of opens/closes', async ({ page }) => {
    // ~6 years of history puts day 0 at the heavily-compressed oldest edge
    // of the log x-axis — see dayWidth()'s own tests for the same shape.
    const series = {
      days: ['2020-01-01', '2026-09-01'],
      bugs:  [{ count: 1, opens: 1, closes: 0 }, { count: 1, opens: 0, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const width = await page.evaluate((series) => {
      renderIssueChart(series);
      return +document.querySelector('#iBugBeads rect').getAttribute('width');
    }, series);
    expect(width).toBeLessThan(1); // sub-pixel at the oldest edge of a 6-year history
  });

  test('shows a message and hides the chart when there is no data', async ({ page }) => {
    await page.evaluate(() => renderIssueChart({ days: [], bugs: [], feats: [], misc: [], total: 0 }));
    await expect(page.locator('#issueMsg')).toHaveText('No issue data yet.');
    await expect(page.locator('#issueChartSvg')).toBeHidden();
  });
});
