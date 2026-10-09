// @ts-check
const { test, expect } = require('@playwright/test');

// The star chart reads each repo's star timestamps from its `starlines`
// branch (written by the Starline README action) and draws new stars per
// quarter as stacked bands, one color per repo. A repo keeps its color for
// good; repos past the palette's size fold into "other".

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !starLoading);
}

const DAY = 86400000;

test.describe('assignStarColors', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('only the top 4 repos by stars get a color, most-starred first', async ({ page }) => {
    const map = await page.evaluate(() =>
      assignStarColors({ 'o/a': 1, 'o/b': 9, 'o/c': 4, 'o/d': 7, 'o/e': 5, 'o/f': 2 }, {}));
    expect(map).toEqual({ 'o/b': 0, 'o/d': 1, 'o/e': 2, 'o/c': 3 });
  });

  test('a repo keeps its color after it drops out of the top 4, so it comes back in the same color', async ({ page }) => {
    const map = await page.evaluate(() => assignStarColors(
      { 'o/a': 50, 'o/b': 40, 'o/c': 30, 'o/new': 20, 'o/d': 2 },
      { 'o/a': 0, 'o/b': 1, 'o/c': 2, 'o/d': 3 }));
    expect(map).toEqual({ 'o/a': 0, 'o/b': 1, 'o/c': 2, 'o/d': 3, 'o/new': 4 }); // newcomer gets a fresh color
  });

  test('existing colors never move when the ranking changes', async ({ page }) => {
    const map = await page.evaluate(() =>
      assignStarColors({ 'o/a': 50, 'o/b': 2, 'o/new': 30 }, { 'o/b': 0, 'o/a': 2 }));
    expect(map).toEqual({ 'o/b': 0, 'o/a': 2, 'o/new': 1 }); // fills the gap, doesn't reshuffle
  });

  test('repos with no stars get no color', async ({ page }) => {
    const map = await page.evaluate(() => assignStarColors({ 'o/a': 0, 'o/b': 3 }, {}));
    expect(map).toEqual({ 'o/b': 0 });
  });

  test('when every palette color is taken, a newcomer to the top 4 takes one from a repo outside it', async ({ page }) => {
    const { map, slots } = await page.evaluate(() => {
      const saved = Object.fromEntries([...Array(STAR_SLOTS).keys()].map(i => [`o/old${i}`, i]));
      const totals = { 'o/old0': 90, 'o/old1': 80, 'o/old2': 70, 'o/new': 60 };
      for (let i = 3; i < STAR_SLOTS; i++) totals[`o/old${i}`] = 1;
      return { map: assignStarColors(totals, saved), slots: STAR_SLOTS };
    });
    expect(map['o/new']).toBe(3);         // the lowest slot not held by a shown repo
    expect(map['o/old3']).toBeUndefined(); // gave it up
    expect(new Set(Object.values(map)).size).toBe(Object.keys(map).length);
    expect(Object.keys(map)).toHaveLength(slots);
  });
});

test.describe('buildStarSeries', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('buckets are rolling quarters ending now, so the current quarter is never partial', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const s = await page.evaluate(({ now, DAY }) => buildStarSeries(
      { 'o/a': [now - 10 * DAY, now - 100 * DAY, now - 200 * DAY] }, { 'o/a': 0 }, now), { now, DAY });
    expect(s.n).toBe(3);
    expect(s.bands[0].counts).toEqual([1, 1, 1]); // 200, 100 and 10 days ago
    expect(s.now).toBe(now);
    expect(s.total).toBe(3);
  });

  test('a star 10 days ago is in the last bucket, one 100 days ago in the one before', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const s = await page.evaluate(({ now, DAY }) => buildStarSeries(
      { 'o/a': [now - 10 * DAY, now - 11 * DAY], 'o/b': [now - 100 * DAY] }, { 'o/a': 0, 'o/b': 1 }, now), { now, DAY });
    expect(s.n).toBe(2);
    expect(s.bands.map(b => b.counts)).toEqual([[0, 2], [1, 0]]);
  });

  test('unassigned repos share one "other" band, stacked last; colored bands go in slot order', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const s = await page.evaluate(({ now, DAY }) => buildStarSeries({
      'o/x': [now - DAY], 'o/a': [now - DAY], 'o/y': [now - DAY, now - 2 * DAY], 'o/b': [now - DAY],
    }, { 'o/a': 3, 'o/b': 1 }, now), { now, DAY });
    expect(s.bands.map(b => b.slot)).toEqual([1, 3, 'other']);
    const other = s.bands[2];
    expect(other.names.sort()).toEqual(['o/x', 'o/y']);
    expect(other.total).toBe(3);
  });

  test('only the top 4 repos by stars get their own band, even if others have a saved color', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const s = await page.evaluate(({ now, DAY }) => {
      const stars = n => [...Array(n).keys()].map(i => now - (i + 1) * DAY);
      return buildStarSeries({ 'o/a': stars(9), 'o/b': stars(8), 'o/c': stars(7), 'o/d': stars(6), 'o/e': stars(1) },
        { 'o/a': 0, 'o/b': 1, 'o/c': 2, 'o/d': 3, 'o/e': 4 }, now);
    }, { now, DAY });
    expect(s.bands.map(b => b.slot)).toEqual([0, 1, 2, 3, 'other']);
    expect(s.bands[4].names).toEqual(['o/e']);
  });

  test('no stars at all gives no series', async ({ page }) => {
    const s = await page.evaluate(() => buildStarSeries({ 'o/a': [] }, {}, Date.now()));
    expect(s).toBeNull();
  });
});

test.describe('fetchStarline', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('a public repo is read from raw.githubusercontent.com with no PAT', async ({ page }) => {
    const { calls, out } = await page.evaluate(async () => {
      const calls = [];
      S.pat = 'ghp_secret';
      window.fetch = async (url, opts) => { calls.push({ url: String(url), opts: opts || null }); return { ok: true, json: async () => [3, 2, 1] }; };
      const out = await fetchStarline({ full_name: 'Own/Repo', private: false }, { Authorization: 'token ghp_secret' });
      return { calls, out };
    });
    expect(out).toEqual([3, 2, 1]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://raw.githubusercontent.com/Own/Repo/starlines/Own/Repo/starline-cache.json');
    expect(JSON.stringify(calls[0].opts || {})).not.toContain('ghp_secret');
  });

  test('a private repo goes through api.github.com with the PAT, asking for the raw file', async ({ page }) => {
    const calls = await page.evaluate(async () => {
      const calls = [];
      S.pat = 'ghp_secret';
      window.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return { ok: true, json: async () => [1] }; };
      await fetchStarline({ full_name: 'Own/Priv', private: true }, { Authorization: 'token ghp_secret' });
      return calls;
    });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).hostname).toBe('api.github.com');
    expect(calls[0].url).toBe('https://api.github.com/repos/Own/Priv/contents/Own/Priv/starline-cache.json?ref=starlines');
    expect(calls[0].opts.headers.Authorization).toBe('token ghp_secret');
    expect(calls[0].opts.headers.Accept).toBe('application/vnd.github.raw+json');
  });

  test('a private repo with no PAT is skipped without a request', async ({ page }) => {
    const { calls, out } = await page.evaluate(async () => {
      let calls = 0;
      S.pat = '';
      window.fetch = async () => { calls++; return { ok: true, json: async () => [1] }; };
      const out = await fetchStarline({ full_name: 'Own/Priv', private: true }, {});
      return { calls, out };
    });
    expect(calls).toBe(0);
    expect(out).toBeNull();
  });

  test('a repo with no starlines branch (404) or a network error gives null', async ({ page }) => {
    const out = await page.evaluate(async () => {
      window.fetch = async () => ({ ok: false, status: 404 });
      const a = await fetchStarline({ full_name: 'o/a' }, {});
      window.fetch = async () => { throw new Error('down'); };
      const b = await fetchStarline({ full_name: 'o/a' }, {});
      return [a, b];
    });
    expect(out).toEqual([null, null]);
  });
});

test.describe('loadStars', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('uses canonical names from S.data, not stale Settings strings, and persists colors', async ({ page }) => {
    const res = await page.evaluate(async (DAY) => {
      const now = Date.now(), urls = [];
      S.repos = ['ScottKirvan/RepoWatch']; // stale — renamed on GitHub
      S.data  = [{ full_name: 'ScottKirvan/Smokey', private: false }];
      localStorage.removeItem(STAR_COLORS_KEY);
      window.fetch = async (url) => {
        urls.push(String(url));
        return String(url).includes('/Smokey/') ? { ok: true, json: async () => [now - DAY] } : { ok: false, status: 404 };
      };
      await loadStars({});
      return { urls, saved: JSON.parse(localStorage.getItem(STAR_COLORS_KEY)), range: document.getElementById('starRange').textContent };
    }, DAY);
    expect(res.urls).toEqual(['https://raw.githubusercontent.com/ScottKirvan/Smokey/starlines/ScottKirvan/Smokey/starline-cache.json']);
    expect(res.saved).toEqual({ 'ScottKirvan/Smokey': 0 });
    expect(res.range).toBe('· 1 stars · new per quarter');
  });

  test('a color saved earlier is kept on the next load', async ({ page }) => {
    const saved = await page.evaluate(async (DAY) => {
      const now = Date.now();
      S.data = [{ full_name: 'o/a' }, { full_name: 'o/b' }];
      localStorage.setItem(STAR_COLORS_KEY, JSON.stringify({ 'o/a': 5 }));
      window.fetch = async (url) => ({ ok: true, json: async () => String(url).includes('/o/a/') ? [now - DAY] : [now - DAY, now - 2 * DAY] });
      await loadStars({});
      return JSON.parse(localStorage.getItem(STAR_COLORS_KEY));
    }, DAY);
    expect(saved).toEqual({ 'o/a': 5, 'o/b': 0 });
  });
});

test.describe('renderStarChart', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('draws one band per series band, and a legend with totals', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const out = await page.evaluate(({ now, DAY }) => {
      renderStarChart(buildStarSeries({
        'o/a': [now - DAY, now - 400 * DAY], 'o/b': [now - 200 * DAY], 'o/c': [now - 5 * DAY],
      }, { 'o/a': 0, 'o/b': 1 }, now));
      return {
        bands: document.querySelectorAll('#starBands .star-band').length,
        legend: [...document.querySelectorAll('#starLegend .legend-item')].map(e => e.textContent),
        fills: [...document.querySelectorAll('#starBands .star-band')].map(e => e.getAttribute('fill')),
      };
    }, { now, DAY });
    expect(out.bands).toBe(3);
    expect(out.legend).toEqual(['a2', 'b1', 'other (1)1']);
    expect(out.fills).toEqual(['var(--star-1)', 'var(--star-2)', 'var(--text-dim)']);
    await expect(page.locator('#starChartSvg')).toBeVisible();
    await expect(page.locator('#starMsg')).toBeHidden();
    await expect(page.locator('#starXLabels span').last()).toHaveText('now');
  });

  test('no band draws a colored line where it has no stars', async ({ page }) => {
    // Each band used to get a colored edge along its top, which for an empty
    // stretch of a band lies on top of the bands below: a repo with one recent
    // star drew its color across the whole history.
    const now = Date.UTC(2026, 9, 8);
    const strokes = await page.evaluate(({ now, DAY }) => {
      renderStarChart(buildStarSeries({
        'o/a': [...Array(20).keys()].map(i => now - i * 60 * DAY), 'o/b': [now - DAY],
      }, { 'o/a': 0, 'o/b': 1 }, now));
      return [...document.querySelectorAll('#starBands path')].map(p => p.getAttribute('stroke'));
    }, { now, DAY });
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.every(s => s === 'var(--surface)')).toBe(true);
  });

  test('year labels sit at the same x the curve uses for that date', async ({ page }) => {
    // Each bucket's point is plotted at the bucket's end (the last one at
    // "now"), so a date's x runs from the first bucket's end to now.
    const now = Date.UTC(2026, 9, 8);
    const { labels, want } = await page.evaluate(({ now, DAY }) => {
      const s = buildStarSeries({ 'o/a': [now - 1500 * DAY, now - DAY] }, { 'o/a': 0 }, now);
      renderStarChart(s);
      const t0 = s.start + STAR_BUCKET_MS;
      const want = {};
      for (const yr of [2023, 2024, 2025, 2026]) want[yr] = (Date.UTC(yr, 0, 1) - t0) / (now - t0) * 100;
      const labels = Object.fromEntries([...document.querySelectorAll('#starXLabels span')]
        .filter(e => /^\d+$/.test(e.textContent)).map(e => [e.textContent, parseFloat(e.style.left)]));
      return { labels, want };
    }, { now, DAY });
    expect(Object.keys(labels)).toEqual(['2023', '2024', '2025', '2026']);
    for (const yr of Object.keys(labels)) expect(labels[yr]).toBeCloseTo(want[yr], 0);
  });

  test('band heights are linear in the star count', async ({ page }) => {
    // o/a gets 1 star a quarter and o/b 3, so the stack tops out at 4 and o/a's
    // top edge sits a quarter of the way up the plot (TOP 6, BOT 4, H 80).
    const now = Date.UTC(2026, 9, 8);
    const d = await page.evaluate(({ now, DAY }) => {
      const q = i => now - (i * 91 + 10) * DAY;
      renderStarChart(buildStarSeries({
        'o/a': [0, 1, 2, 3].map(q), 'o/b': [0, 1, 2, 3].flatMap(i => [q(i), q(i) - DAY, q(i) - 2 * DAY]),
      }, { 'o/a': 0, 'o/b': 1 }, now));
      return [...document.querySelectorAll('#starBands .star-band')].map(p => p.getAttribute('d'));
    }, { now, DAY });
    expect(d[0].startsWith('M0.0,58.50 ')).toBe(true); // 76 - 70/4
    expect(d[1].startsWith('M0.0,6.00 ')).toBe(true);  // the top of the stack
  });

  test('legend names keep the repo name\'s own case', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const out = await page.evaluate(({ now, DAY }) => {
      renderStarChart(buildStarSeries({ 'o/ScooterUtils': [now - DAY] }, { 'o/ScooterUtils': 0 }, now));
      const item = document.querySelector('#starLegend .legend-item');
      return { text: item.textContent, transform: getComputedStyle(item).textTransform };
    }, { now, DAY });
    expect(out.text).toBe('ScooterUtils1');
    expect(out.transform).toBe('none');
  });

  test('every band path stays inside the chart box', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const box = await page.evaluate(({ now, DAY }) => {
      renderStarChart(buildStarSeries({
        'o/a': [...Array(30).keys()].map(i => now - (300 + i) * DAY), 'o/b': [now - DAY],
      }, { 'o/a': 0, 'o/b': 1 }, now));
      const bb = [...document.querySelectorAll('#starBands path')].map(p => p.getBBox());
      return {
        minY: Math.min(...bb.map(b => b.y)), maxY: Math.max(...bb.map(b => b.y + b.height)),
        minX: Math.min(...bb.map(b => b.x)), maxX: Math.max(...bb.map(b => b.x + b.width)),
      };
    }, { now, DAY });
    expect(box.minY).toBeGreaterThanOrEqual(0);
    expect(box.maxY).toBeLessThanOrEqual(80);
    expect(box.minX).toBeGreaterThanOrEqual(0);
    expect(box.maxX).toBeLessThanOrEqual(1000);
  });

  test('a single bucket of history still renders', async ({ page }) => {
    const now = Date.UTC(2026, 9, 8);
    const n = await page.evaluate(({ now, DAY }) => {
      renderStarChart(buildStarSeries({ 'o/a': [now - DAY] }, { 'o/a': 0 }, now));
      return document.querySelectorAll('#starBands .star-band').length;
    }, { now, DAY });
    expect(n).toBe(1);
    await expect(page.locator('#starChartSvg')).toBeVisible();
  });

  test('shows a message and hides the chart when there is no star history', async ({ page }) => {
    await page.evaluate(() => renderStarChart(null));
    await expect(page.locator('#starMsg')).toHaveText('No star history yet.');
    await expect(page.locator('#starChartSvg')).toBeHidden();
    await expect(page.locator('#starLegend')).toBeEmpty();
    await expect(page.locator('#starRange')).toHaveText('');
  });
});
