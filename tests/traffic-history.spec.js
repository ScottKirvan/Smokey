// @ts-check
const { test, expect } = require('@playwright/test');

// GitHub's live traffic API only returns a rolling 14-day window (and even
// that can lag by more than a day — see the "yest shows zero" case). This
// is the only traffic data source now: a daily CSV snapshot accumulated on
// the traffic-log branch by a separate weekly workflow (log-traffic.yml),
// unbounded by that 14-day window. renderChart's log x-axis / sqrt y-axis
// scaling is unchanged from the original 14-day chart — both are already
// parameterized by data.length, so the same math applies to a longer,
// growing range without modification.

test.describe('parseTrafficCsv', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('parses rows and skips the header', async ({ page }) => {
    const csv = 'repo,date,views,unique_visitors\nowner/a,2026-09-01,10,3\nowner/b,2026-09-01,5,2\n';
    const rows = await page.evaluate((csv) => parseTrafficCsv(csv), csv);
    expect(rows).toEqual([
      { repo: 'owner/a', date: '2026-09-01', views: 10, uniques: 3 },
      { repo: 'owner/b', date: '2026-09-01', views: 5, uniques: 2 },
    ]);
  });

  test('ignores a trailing blank line', async ({ page }) => {
    const csv = 'repo,date,views,unique_visitors\nowner/a,2026-09-01,10,3\n\n';
    const rows = await page.evaluate((csv) => parseTrafficCsv(csv), csv);
    expect(rows).toHaveLength(1);
  });
});

test.describe('aggregateTrafficHistory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('sums views/uniques across repos for the same date', async ({ page }) => {
    const rows = [
      { repo: 'owner/a', date: '2026-09-02', views: 10, uniques: 3 },
      { repo: 'owner/b', date: '2026-09-02', views: 5, uniques: 2 },
      { repo: 'owner/a', date: '2026-09-01', views: 1, uniques: 1 },
    ];
    const result = await page.evaluate((rows) => aggregateTrafficHistory(rows), rows);
    // sorted chronologically, not input order
    expect(result).toEqual([
      { date: '2026-09-01', views: 1, uniques: 1 },
      { date: '2026-09-02', views: 15, uniques: 5 },
    ]);
  });

  test('returns an empty array for no rows', async ({ page }) => {
    const result = await page.evaluate(() => aggregateTrafficHistory([]));
    expect(result).toEqual([]);
  });
});

test.describe('renderChart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('shows a message and hides the chart when there is no data', async ({ page }) => {
    await page.evaluate(() => renderChart([]));
    await expect(page.locator('#chartNoPat')).toBeVisible();
    await expect(page.locator('#chartNoPat')).toHaveText('No traffic history yet.');
    await expect(page.locator('#chartSvg')).toBeHidden();
    await expect(page.locator('#chartLabels')).toBeHidden();
    await expect(page.locator('#trafficRange')).toHaveText('');
  });

  test('renders totals, day count, and oldest/newest date labels for a growing range', async ({ page }) => {
    // 20 points — longer than the old fixed 14-day window, confirming the
    // log-scale math (parameterized by n) still works past that bound.
    const data = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      views: i === 10 ? 100 : 1, // one clear peak
      uniques: 1,
    }));
    await page.evaluate((data) => renderChart(data), data);

    await expect(page.locator('#chartSvg')).toBeVisible();
    await expect(page.locator('#trafficRange')).toHaveText('· 20 days');
    await expect(page.locator('#trafficTotal')).toHaveText('119 views · 20 unique');

    const labels = page.locator('#chartLabels span');
    await expect(labels).toHaveCount(2);
    await expect(labels.first()).toHaveText('2026-08-01');
    await expect(labels.last()).toHaveText('2026-08-20');

    await expect(page.locator('#chartPeakLbl')).toHaveText('100');
  });

  test('handles a single data point without a log(0) error', async ({ page }) => {
    await page.evaluate(() => renderChart([{ date: '2026-09-01', views: 5, uniques: 2 }]));
    await expect(page.locator('#chartSvg')).toBeVisible();
    await expect(page.locator('#trafficTotal')).toHaveText('5 views · 2 unique');
  });
});

test.describe('loadTraffic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('fetches, filters to monitored repos, and renders', async ({ page }) => {
    const csv = [
      'repo,date,views,unique_visitors',
      'ScottKirvan/Smokey,2026-09-01,10,3',
      'ScottKirvan/NotMonitored,2026-09-01,99,9',
    ].join('\n');

    await page.evaluate(async (csv) => {
      S.repos = ['ScottKirvan/Smokey'];
      window.fetch = async (url) => {
        if (String(url).includes('traffic-log/views.csv')) {
          return { ok: true, text: async () => csv };
        }
        return { ok: false, status: 404 };
      };
      await loadTraffic();
    }, csv);

    await expect(page.locator('#chartSvg')).toBeVisible();
    await expect(page.locator('#trafficTotal')).toHaveText('10 views · 3 unique');
  });

  test('shows a message when the log branch has no file yet (404)', async ({ page }) => {
    await page.evaluate(async () => {
      window.fetch = async () => ({ ok: false, status: 404 });
      await loadTraffic();
    });

    await expect(page.locator('#chartNoPat')).toHaveText('No traffic history yet.');
    await expect(page.locator('#chartSvg')).toBeHidden();
  });

  test('shows a message on a network failure rather than throwing', async ({ page }) => {
    await page.evaluate(async () => {
      window.fetch = async () => { throw new Error('network down'); };
      await loadTraffic();
    });

    await expect(page.locator('#chartNoPat')).toHaveText('No traffic history yet.');
  });
});
