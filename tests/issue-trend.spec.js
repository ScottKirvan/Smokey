// @ts-check
const { test, expect } = require('@playwright/test');

// The issue trend chart draws a thin connecting line across every day (the
// running open-issue count), with one diamond/dart candle on top for each
// day that had activity, painted over the line so the line reads as
// underneath it. Each candle is centered on y0, the day's running count
// (the same position the line sits at) — widest at y0, tapering to a
// point at its top and bottom tips, with a small blurred glow behind its
// center. The candle is the category's bright core color exactly at y0,
// fading to its near-black tip color at both ends. The core marks where the
// line is; the reach above/below shows how many issues opened (up) vs closed (down)
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
      // HTML dots over the SVG: left is a % of the 1000-unit width, top is px (1 unit = 1px)
      const dots = [...document.querySelectorAll('#issueNowDots .issue-now-dot')]
        .map(d => [parseFloat(d.style.left) * 10, parseFloat(d.style.top)]);
      const lineEnds = ['iBugBeads', 'iFeatBeads', 'iMiscBeads'].map(id => {
        const p = [...document.querySelector(`#${id} .issue-line`).points].pop();
        return [p.x, p.y];
      });
      return { dots, lineEnds };
    }, series);
    expect(dots).toHaveLength(3);
    for (const end of lineEnds) {
      expect(dots.some(([x, y]) => Math.abs(x - end[0]) < 0.1 && Math.abs(y - end[1]) < 0.5)).toBe(true);
    }
  });

  test('draws a half-pixel graph-paper grid covering the whole svg, with major lines at the labels', async ({ page }) => {
    // 2024-11-01 is ~700 days back: labeled milestones 1mo, 6mo, 1yr plus
    // today are the majors; weeks 1-3 and months 2-5, 7-11 are the minors
    // (yearly minors start at 4yr, beyond this history).
    const series = {
      days: ['2024-11-01', '2026-09-01'],
      bugs:  [{ count: 1, opens: 1, closes: 0 }, { count: 2, opens: 1, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 2,
    };
    const g = await page.evaluate((series) => {
      renderIssueChart(series);
      const all = sel => [...document.querySelectorAll(`#issueGrid ${sel}`)];
      const vb = document.getElementById('issueChartSvg').viewBox.baseVal;
      return {
        hY:      all('.issue-grid-h').map(l => +l.getAttribute('y1')),
        hSpan:   all('.issue-grid-h').every(l => +l.getAttribute('x1') === 0 && +l.getAttribute('x2') === vb.width),
        vSpan:   all('.issue-grid-major, .issue-grid-minor').every(l => +l.getAttribute('y1') === 0 && +l.getAttribute('y2') === vb.height),
        majors:  all('.issue-grid-major').length,
        minors:  all('.issue-grid-minor').length,
        labels:  document.querySelectorAll('#issueXLabels span').length,
        widths:  [...new Set(all('line').map(l => l.getAttribute('stroke-width')))],
        height:  vb.height,
      };
    }, series);
    expect(g.hY[0]).toBe(0);
    expect(g.hY[g.hY.length - 1]).toBe(g.height); // top edge to bottom edge
    expect(g.hY).toHaveLength(g.height / 10 + 1);
    expect(g.hSpan).toBe(true);                   // left edge to right edge
    expect(g.vSpan).toBe(true);                   // every vertical runs the full height
    expect(g.majors).toBe(g.labels);              // one major per label, "today" included
    expect(g.minors).toBe(3 + 9);
    expect(g.widths).toEqual(['0.5']);
  });

  test('axis labels line up with their grid lines: milestones centered on theirs, "today" ending at the today line', async ({ page }) => {
    const series = {
      days: ['2023-01-01', '2026-09-01'],
      bugs:  [{ count: 1, opens: 1, closes: 0 }, { count: 2, opens: 1, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 2,
    };
    const { labels, lines } = await page.evaluate((series) => {
      renderIssueChart(series);
      const labels = [...document.querySelectorAll('#issueXLabels span')].map(s => {
        const r = s.getBoundingClientRect();
        return { text: s.textContent, center: (r.left + r.right) / 2, right: r.right };
      });
      const lines = [...document.querySelectorAll('#issueGrid .issue-grid-major')]
        .map(l => l.getBoundingClientRect().left).sort((a, b) => a - b);
      return { labels, lines };
    }, series);
    const today = labels.find(l => l.text === 'today');
    const todayLine = lines[lines.length - 1];
    expect(Math.abs(today.right - todayLine)).toBeLessThan(2);
    for (const l of labels.filter(l => l.text !== 'today')) {
      const nearest = Math.min(...lines.map(x => Math.abs(x - l.center)));
      expect(nearest, `${l.text} should be centered on its line`).toBeLessThan(2);
    }
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
        .find(s => s.classList.contains('issue-core-stop')).getAttribute('offset');
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
        .find(s => s.classList.contains('issue-core-stop')).getAttribute('offset');
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
        .find(s => s.classList.contains('issue-core-stop')).getAttribute('offset');
    }, series);
    expect(stop).toBe('0.500');
  });

  test('full tip color holds through the outer half of each side, keeping the core color a tight band at y0', async ({ page }) => {
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
        .map(s => ({ offset: s.getAttribute('offset'), color: s.getAttribute('style').replace('stop-color:', '') }));
    }, series);
    expect(stops).toEqual([
      { offset: '0',     color: 'var(--bug)' },
      { offset: '0.250', color: 'var(--bug)' },
      { offset: '0.500', color: 'var(--bug-core)' },
      { offset: '0.750', color: 'var(--bug)' },
      { offset: '1',     color: 'var(--bug)' },
    ]);
  });

  test('legend swatches use each category\'s bright core color, matching the spikes rather than the dark lines', async ({ page }) => {
    const swatches = await page.evaluate(() =>
      [...document.querySelectorAll('.issue-legend .legend-swatch')].map(s => s.getAttribute('style')));
    expect(swatches).toEqual(['background:var(--bug-core)', 'background:var(--feat-core)', 'background:var(--misc-core)']);
  });

  test('each category uses its own core color for the needle center and glow, and its line color for the line and today dot', async ({ page }) => {
    const series = {
      days: ['2026-06-01'],
      bugs:  [{ count: 5, opens: 4, closes: 2 }],
      feats: [{ count: 3, opens: 2, closes: 1 }],
      misc:  [{ count: 1, opens: 1, closes: 1 }],
      total: 3,
    };
    const got = await page.evaluate((series) => {
      renderIssueChart(series);
      const nowDots = [...document.querySelectorAll('#issueNowDots .issue-now-dot')].map(d => d.style.background);
      return ['Bug', 'Feat', 'Misc'].map((id, i) => {
        const g = document.getElementById(`i${id}Beads`);
        return {
          core: g.querySelector('.issue-core-stop').getAttribute('style'),
          glow: g.querySelector('.issue-glow').getAttribute('fill'),
          glowStop: document.querySelector(g.querySelector('.issue-glow').getAttribute('fill').slice(4, -1) + ' stop').getAttribute('style'),
          line: g.querySelector('.issue-line').getAttribute('stroke'),
          now:  nowDots[i],
        };
      });
    }, series);
    expect(got).toEqual(['bug', 'feat', 'misc'].map(cat => ({
      core: `stop-color:var(--${cat}-core)`,
      glow: `url(#issueGlow-${cat})`,
      glowStop: `stop-color:var(--${cat}-core);stop-opacity:1`,
      line: `var(--${cat}-line)`,
      now:  `var(--${cat}-line)`,
    })));
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

  test('the header reads "· N issues · span", without the word "history" that made it wrap on a phone', async ({ page }) => {
    await page.evaluate(() => renderIssueChart({
      days: ['2024-04-04', '2026-09-01'],
      bugs:  [{ count: 1, opens: 1, closes: 0 }, { count: 2, opens: 1, closes: 0 }],
      feats: [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
      total: 2,
    }));
    await expect(page.locator('#issueRange')).toHaveText(/^· 2 issues · \d+(\.\d)?yr$/);
  });

  test('shows a message and hides the chart when there is no data', async ({ page }) => {
    await page.evaluate(() => renderIssueChart({ days: [], bugs: [], feats: [], misc: [], total: 0 }));
    await expect(page.locator('#issueMsg')).toHaveText('No issue data yet.');
    await expect(page.locator('#issueChartSvg')).toBeHidden();
  });
});

test.describe('issue chart sweep animation', () => {
  // ~1 year of history, one active bug day near each end so there are
  // needles on both sides of a mid-sweep front.
  const series = {
    days: ['2025-10-10', '2026-03-01', '2026-09-20'],
    bugs:  [{ count: 2, opens: 2, closes: 0 }, { count: 2, opens: 0, closes: 0 }, { count: 4, opens: 3, closes: 1 }],
    feats: [{ count: 1, opens: 1, closes: 0 }, { count: 1, opens: 0, closes: 0 }, { count: 1, opens: 0, closes: 0 }],
    misc:  [{ count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }, { count: 0, opens: 0, closes: 0 }],
    total: 7,
  };
  const state = page => page.evaluate(() => {
    const svg = document.getElementById('issueChartSvg');
    return {
      sweeping: svg.classList.contains('issue-sweeping'),
      front:    +document.getElementById('issueSweepRect').getAttribute('width'),
      clipped:  document.getElementById('issueSweep').hasAttribute('clip-path'),
      heads:    document.querySelectorAll('#issueHeads .issue-head').length,
      scan:     document.querySelectorAll('#issueHeads .issue-scan').length,
      // CSS animations running on anything inside the chart SVG. Per-needle
      // animations (hundreds) made the sweep stutter and, held on their final
      // frame, kept costing every frame after it ended, jittering the tickers.
      svgAnims: document.getAnimations().filter(a => a.effect && a.effect.target && svg.contains(a.effect.target)).length,
    };
  });

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await gotoQuiet(page);
    await page.clock.pauseAt(new Date(Date.now() + 60000));
    await page.evaluate((series) => renderIssueChart(series), series);
  });

  test('rendering the chart on its own does not start a sweep', async ({ page }) => {
    expect((await state(page)).sweeping).toBe(false);
  });

  test('reveals left to right behind a scanline with a dot riding each line, then cleans up', async ({ page }) => {
    const ms = await page.evaluate(() => { playIssueSweep(); return SWEEP_MS; });
    await page.clock.runFor(ms / 2);
    const mid = await state(page);
    expect(mid).toMatchObject({ sweeping: true, clipped: true, heads: 3, scan: 2, svgAnims: 0 });
    // Constant speed: halfway through the time, halfway across. An ease-out
    // used to cover two-thirds of the width in the first few frames.
    const XW = await page.evaluate(() => issueSweepGeom.XW);
    expect(mid.front / XW).toBeCloseTo(0.5, 1);

    await page.clock.runFor(ms / 2 + 100);
    const end = await state(page);
    expect(end).toMatchObject({ sweeping: false, clipped: false, heads: 0, scan: 0, front: 1000, svgAnims: 0 });
  });

  test('the riding dots stay on their lines', async ({ page }) => {
    await page.evaluate(() => playIssueSweep());
    await page.clock.runFor(500);
    const { heads, lines } = await page.evaluate(() => ({
      heads: [...document.querySelectorAll('#issueHeads .issue-head')]
        .map(h => h.getAttribute('d').match(/^M([\d.]+),([\d.]+)/).slice(1).map(Number)),
      lines: issueSweepGeom.lines.map(l => l.pts),
    }));
    heads.forEach(([x, y], i) => {
      const pts = lines[i];
      const j = pts.findIndex(p => p[0] >= x);
      const [x0, y0] = pts[Math.max(0, j - 1)], [x1, y1] = pts[j];
      const expected = x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
      expect(y).toBeCloseTo(expected, 1);
    });
  });

  test('a click on the chart starts the sweep, and a click mid-sweep restarts it from the left', async ({ page }) => {
    await page.locator('#issueChartSvg').click();
    await page.clock.runFor(800);
    const first = await state(page);
    expect(first.sweeping).toBe(true);

    await page.locator('#issueChartSvg').click();
    await page.clock.runFor(100);
    const restarted = await state(page);
    expect(restarted.sweeping).toBe(true);
    expect(restarted.front).toBeLessThan(first.front);
  });

  test('with reduced motion on, clicking does nothing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#issueChartSvg').click();
    await page.clock.runFor(100);
    expect((await state(page)).sweeping).toBe(false);
  });

  test('a load plays one sweep on its first render with data, not again on the re-render after the fetch', async ({ page }) => {
    const plays = await page.evaluate(async () => {
      let plays = 0;
      const real = window.playIssueSweep;
      window.playIssueSweep = () => { plays++; real(); };
      localStorage.setItem('rw_issues_v1', JSON.stringify({ 'o/a': { 1: { c: '2026-09-01T00:00:00Z', x: null, t: 'bug' } } }));
      localStorage.removeItem('rw_sync_v1');
      S.data = [{ full_name: 'o/a' }];
      let page = 0;
      window.fetch = async () => ({
        ok: true, status: 200,
        json: async () => (page++ === 0
          ? [{ number: 2, created_at: '2026-09-15T00:00:00Z', closed_at: null, labels: [] }]
          : []),
      });
      await loadIssueHistory();
      window.playIssueSweep = real;
      return plays;
    });
    expect(plays).toBe(1);
  });
});
