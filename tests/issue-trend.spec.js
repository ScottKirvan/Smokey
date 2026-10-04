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

  test('logX puts today on the right edge and the oldest day on the left, with no dead space', async ({ page }) => {
    // Shifting the log epsilon off +1 without re-normalizing put "today" at
    // ~75% of the width, leaving the right quarter of the chart empty.
    const [today, oldest] = await page.evaluate(() => [logX(0, 2190, 1000), logX(2190, 2190, 1000)]);
    expect(today).toBeCloseTo(1000, 5);
    expect(oldest).toBeCloseTo(0, 5);
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

  test('draws one connecting line per category, across every day including inactive ones, held flat to today', async ({ page }) => {
    const series = {
      days: ['2026-01-01', '2026-01-02', '2026-09-01'],
      bugs:  [{ count: 2, opens: 2, closes: 0 }, { count: 2, opens: 0, closes: 0 }, { count: 4, opens: 3, closes: 1 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 5,
    };
    const pts = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelector('#iBugBeads .issue-line').points].map(p => ({ x: p.x, y: p.y }));
    }, series);
    await expect(page.locator('#iBugBeads .issue-line')).toHaveCount(1);
    expect(pts).toHaveLength(4); // one point per day, plus the hold to today
    const [lastDay, today] = pts.slice(-2);
    expect(today.y).toBe(lastDay.y);        // the count holds flat until today
    expect(today.x).toBeGreaterThan(lastDay.x);
  });

  test('the line has a blurred glow copy underneath it, and both keep a fixed pixel width', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const lines = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelectorAll('#iBugBeads polyline')].map(l => ({
        cls: l.getAttribute('class'), filter: l.getAttribute('filter'), ve: l.getAttribute('vector-effect'),
      }));
    }, series);
    expect(lines).toEqual([
      { cls: 'issue-line-glow', filter: 'url(#issueLineBlur)', ve: 'non-scaling-stroke' },
      { cls: 'issue-line',      filter: null,                  ve: 'non-scaling-stroke' },
    ]);
  });

  test('puts a "today" dot at the right-hand end of each category line', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 2, opens: 2, closes: 0 }],
      misc:  [{ count: 1, opens: 1, closes: 0 }],
      total: 7,
    };
    const { dots, lineEnds } = await page.evaluate((series) => {
      renderIssueChart(series);
      const dots = [...document.querySelectorAll('#issueNow .issue-now:not(.issue-now-halo)')]
        .map(d => d.getAttribute('d').match(/^M([\d.]+),([\d.]+)/).slice(1).map(Number));
      const lineEnds = ['iBugBeads', 'iFeatBeads', 'iMiscBeads'].map(id => {
        const p = [...document.querySelector(`#${id} .issue-line`).points].pop();
        return [p.x, p.y];
      });
      return { dots, lineEnds };
    }, series);
    expect(dots).toHaveLength(3);
    for (const end of lineEnds) {
      expect(dots.some(([x, y]) => Math.abs(x - end[0]) < 0.1 && Math.abs(y - end[1]) < 0.1)).toBe(true);
    }
  });

  test('draws faint gridlines plus a tick under each milestone label and under today', async ({ page }) => {
    // ~2 years of history: milestones at 1mo, 6mo, 1yr, plus today = 4 ticks.
    const series = {
      days: ['2024-11-01', '2026-09-01'],
      bugs:  [{ count: 1, opens: 1, closes: 0 }, { count: 2, opens: 1, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 2,
    };
    const { horizontal, ticks, labels } = await page.evaluate((series) => {
      renderIssueChart(series);
      const lines = [...document.querySelectorAll('#issueGrid line')];
      return {
        horizontal: lines.filter(l => l.getAttribute('y1') === l.getAttribute('y2')).length,
        ticks:      lines.filter(l => l.getAttribute('x1') === l.getAttribute('x2')).length,
        labels:     document.querySelectorAll('#issueXLabels span').length,
      };
    }, series);
    expect(horizontal).toBe(3);
    expect(ticks).toBe(labels); // one tick per label, "today" included
  });

  test('marks blend additively in dark mode and normally in light mode (screen would wash out to white)', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const blend = () => page.evaluate(() =>
      getComputedStyle(document.querySelector('#iBugBeads .issue-candle')).mixBlendMode);
    await page.evaluate((series) => renderIssueChart(series), series);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await blend()).toBe('screen');
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await blend()).toBe('normal');
  });

  test('needles are a fixed few pixels wide at their center, not the full day slot', async ({ page }) => {
    // The most recent day has a wide slot on the log axis; the needle should
    // still be thin. 2.5px half-width -> ~5px across, whatever the stretch.
    const series = {
      days: ['2026-01-01', new Date(Date.now() - 86400000).toISOString().slice(0, 10)],
      bugs:  [{ count: 1, opens: 1, closes: 0 }, { count: 3, opens: 2, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 3,
    };
    const px = await page.evaluate((series) => {
      renderIssueChart(series);
      const needle = [...document.querySelectorAll('#iBugBeads polygon')].pop();
      return needle.getBoundingClientRect().width;
    }, series);
    expect(px).toBeGreaterThan(4);
    expect(px).toBeLessThan(6);
  });

  test('the chart clips overflowing candles at its own box instead of letting them bleed into the page', async ({ page }) => {
    const overflow = await page.evaluate(() => getComputedStyle(document.getElementById('issueChartSvg')).overflow);
    expect(overflow).toBe('hidden');
  });

  test('a day whose reach vastly exceeds the chart is not geometrically clamped — it relies on the svg clipping to cut it', async ({ page }) => {
    const series = {
      days: ['2026-09-30', '2026-10-01'],
      bugs:  [{ count: 50, opens: 0, closes: 0 }, { count: 50, opens: 100, closes: 100 }],
      feats: [{ count: 0, opens: 0, closes: 0 },  { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 },  { count: 0, opens: 0, closes: 0 }],
      total: 2,
    };
    const pts = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelector('#iBugBeads polygon').points].map(p => ({ x: p.x, y: p.y }));
    }, series);
    const ys = pts.map(p => p.y);
    expect(Math.min(...ys)).toBeLessThan(0);    // top tip genuinely above the chart's own 0..80 viewBox
    expect(Math.max(...ys)).toBeGreaterThan(80); // bottom tip genuinely below it
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
    const white = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelectorAll('#iBugBeads linearGradient stop')]
        .find(s => s.getAttribute('style').includes('#fff')).getAttribute('offset');
    }, series);
    expect(white).toBe('1.000');
  });

  test('a closes-only day puts the white stop at the top (the bar extends purely downward from y0)', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 3, opens: 0, closes: 2 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const white = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelectorAll('#iBugBeads linearGradient stop')]
        .find(s => s.getAttribute('style').includes('#fff')).getAttribute('offset');
    }, series);
    expect(white).toBe('0.000');
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
      return [...document.querySelectorAll('#iBugBeads linearGradient stop')]
        .find(s => s.getAttribute('style').includes('#fff')).getAttribute('offset');
    }, series);
    expect(stop).toBe('0.500');
  });

  test('full category color holds through the outer half of each side, keeping white a tight band at y0', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 3, opens: 4, closes: 4 }],
      feats: [{ count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }],
      total: 1,
    };
    const stops = await page.evaluate((series) => {
      renderIssueChart(series);
      return [...document.querySelectorAll('#iBugBeads linearGradient stop')]
        .map(s => ({ offset: s.getAttribute('offset'), white: s.getAttribute('style').includes('#fff') }));
    }, series);
    expect(stops).toEqual([
      { offset: '0',     white: false },
      { offset: '0.250', white: false },
      { offset: '0.500', white: true  },
      { offset: '0.750', white: false },
      { offset: '1',     white: false },
    ]);
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
