// @ts-check
const { test, expect } = require('@playwright/test');

// The issue trend chart draws a thin connecting line across every day (the
// running open-issue count), with one diamond/dart candle on top for each
// day that had activity, painted over the line so the line reads as
// underneath it. Each candle is centered on y0, the day's running count
// (the same position the line sits at) — widest at y0, tapering to a
// point at its top and bottom tips, with a small blurred glow behind that
// white center. The candle fades from the category color to white exactly
// at y0, then back to color at the tips — white marks where the line is;
// color above/below shows how many issues opened (up) vs closed (down)
// that day, via a quadratic (not linear) length so busy days dominate and
// the tallest ones are allowed to clip at the chart's top/bottom edge
// (the taper alone still reads how far they were reaching). This isn't a
// standard chart type (not OHLC candlesticks, not a diverging bar chart)
// — it's a one-off visualization built to show both "where the count is"
// and "how much happened" in one mark per day.

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

  test('today is not wildly wider than its neighbor, even over a multi-year history', async ({ page }) => {
    // A bare log(ago+1) gives "today" a disproportionate jump (the
    // log(1)->log(2) step dwarfs every later, flatter step) — over ~6
    // years that was ~90px of a 1000px-wide chart for one day alone.
    const [today, yesterday] = await page.evaluate(() => [dayWidth(0, 2190, 1000), dayWidth(1, 2190, 1000)]);
    expect(today / yesterday).toBeLessThan(2);
  });
});

test.describe('heatLen', () => {
  test.beforeEach(async ({ page }) => {
    await gotoQuiet(page);
  });

  test('scales quadratically: 10x the value is 100x the length', async ({ page }) => {
    const [one, ten] = await page.evaluate(() => [heatLen(1, 10, 100), heatLen(10, 10, 100)]);
    expect(ten).toBeCloseTo(one * 100, 3);
  });

  test('doubling the value quadruples the length', async ({ page }) => {
    const [two, four] = await page.evaluate(() => [heatLen(2, 10, 100), heatLen(4, 10, 100)]);
    expect(four).toBeCloseTo(two * 4, 5);
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
    await expect(page.locator('#iBugBeads polygon')).toHaveCount(2);
    await expect(page.locator('#iFeatBeads polygon')).toHaveCount(1); // only the first day has activity
    await expect(page.locator('#iMiscBeads polygon')).toHaveCount(0);
  });

  test('draws one connecting line per category, across every day including inactive ones', async ({ page }) => {
    const series = {
      days: ['2026-01-01', '2026-01-02', '2026-09-01'],
      bugs:  [{ count: 2, opens: 2, closes: 0 }, { count: 2, opens: 0, closes: 0 }, { count: 4, opens: 3, closes: 1 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 5,
    };
    const pointCount = await page.evaluate((series) => {
      renderIssueChart(series);
      return document.querySelector('#iBugBeads polyline').points.length;
    }, series);
    await expect(page.locator('#iBugBeads polyline')).toHaveCount(1);
    expect(pointCount).toBe(3); // one point per day, not just the active ones
  });

  test('the line renders before (underneath) the diamonds in the same category group', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const tags = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelector('#iBugBeads').children].map(el => el.tagName.toLowerCase());
    }, series);
    expect(tags.indexOf('polyline')).toBeLessThan(tags.indexOf('polygon'));
  });

  test('draws a small blurred glow circle behind each candle, at its white center point', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const { glowCount, before, cx, cy } = await page.evaluate((series) => {
      renderIssueChart(series);
      const g = document.querySelector('#iBugBeads .issue-glow');
      const children = [...document.querySelector('#iBugBeads').children];
      return {
        glowCount: document.querySelectorAll('#iBugBeads .issue-glow').length,
        before: children.indexOf(g) < children.indexOf(document.querySelector('#iBugBeads polygon')),
        cx: g.getAttribute('cx'),
        cy: g.getAttribute('cy'),
      };
    }, series);
    expect(glowCount).toBe(1);
    expect(before).toBe(true); // glow sits underneath its own diamond
    const polyPoints = await page.evaluate(() =>
      [...document.querySelector('#iBugBeads polygon').points].map(p => ({ x: p.x, y: p.y })));
    const y0 = polyPoints.find((p, i, arr) => arr.filter(q => q.y === p.y).length === 2).y; // the two side (white-center) points
    expect(+cy).toBeCloseTo(y0, 0);
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

  test('bar length scales quadratically with opens/closes, not linearly', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 2, opens: 2, closes: 0 }], // half the max
      feats: [{ count: 1, opens: 4, closes: 0 }], // the max — sets maxVal
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 2,
    };
    const { bugHeight, featHeight } = await page.evaluate((series) => {
      renderIssueChart(series);
      const bbox = sel => document.querySelector(sel).getBBox().height;
      return {
        bugHeight:  bbox('#iBugBeads polygon'),
        featHeight: bbox('#iFeatBeads polygon'),
      };
    }, series);
    // opens=2 against a maxVal of 4 is half the input, but a quarter of the
    // length under quadratic scaling — linear scaling would instead give 50%.
    expect(bugHeight).toBeCloseTo(featHeight / 4, 1);
  });

  test('candle width at the white center point is capped by the day\'s available plot slot', async ({ page }) => {
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
      return document.querySelector('#iBugBeads polygon').getBBox().width;
    }, series);
    expect(width).toBeLessThan(2); // sub-pixel half-width, doubled, at the oldest edge of a 6-year history
  });

  test('the diamond is widest at y0 and tapers to a point at its top and bottom tips', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const pts = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelector('#iBugBeads polygon').points].map(p => ({ x: p.x, y: p.y }));
    }, series);
    const ys = pts.map(p => p.y).sort((a, b) => a - b);
    const top = pts.find(p => p.y === ys[0]);
    const bot = pts.find(p => p.y === ys[ys.length - 1]);
    const mids = pts.filter(p => p !== top && p !== bot);
    expect(top.x).toBeCloseTo(bot.x, 1); // the tips come to a point on the same x
    expect(mids[0].y).toBeCloseTo(mids[1].y, 1); // the two side points sit at the same y (y0)
    expect(Math.abs(mids[0].x - mids[1].x)).toBeGreaterThan(0); // and are spread apart in x
  });

  test('shows a message and hides the chart when there is no data', async ({ page }) => {
    await page.evaluate(() => renderIssueChart({ days: [], bugs: [], feats: [], misc: [], total: 0 }));
    await expect(page.locator('#issueMsg')).toHaveText('No issue data yet.');
    await expect(page.locator('#issueChartSvg')).toBeHidden();
  });
});
