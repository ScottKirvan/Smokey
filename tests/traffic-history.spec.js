// @ts-check
const { test, expect } = require('@playwright/test');

// The 14-day chart is capped by GitHub's live traffic API (see
// traffic-window.spec.js). log-traffic.yml, a separate weekly workflow,
// accumulates a daily CSV snapshot on the traffic-log branch instead —
// this covers Smokey's client-side consumption of that file: parsing,
// aggregating across monitored repos, and rendering.

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

test.describe('renderHistoryChart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('shows the empty message and hides the chart when there is no data', async ({ page }) => {
    // renderHistoryChart() is only ever called after toggleTrafficHistory()
    // has already cleared #historyChartWrap's `hidden` attribute — an
    // ancestor left `hidden` overrides any child's own display style via
    // the app's `[hidden] { display: none !important; }` rule, so calling
    // it directly needs that same precondition set up by hand.
    await page.evaluate(() => { document.getElementById('historyChartWrap').hidden = false; });
    await page.evaluate(() => renderHistoryChart([]));
    await expect(page.locator('#historyEmpty')).toBeVisible();
    await expect(page.locator('#historyEmpty')).toHaveText('No history data for your monitored repos yet.');
    await expect(page.locator('#historyChartSvg')).toBeHidden();
    await expect(page.locator('#historyChartLabels')).toBeHidden();
  });

  test('renders totals and oldest/newest date labels', async ({ page }) => {
    const data = [
      { date: '2026-08-01', views: 10, uniques: 5 },
      { date: '2026-08-02', views: 20, uniques: 8 },
      { date: '2026-08-03', views: 5, uniques: 2 },
    ];
    await page.evaluate(() => { document.getElementById('historyChartWrap').hidden = false; });
    await page.evaluate((data) => renderHistoryChart(data), data);

    await expect(page.locator('#historyChartSvg')).toBeVisible();
    await expect(page.locator('#historyTotal')).toHaveText('35 views · 15 unique · 3 days');

    const labels = page.locator('#historyChartLabels span');
    await expect(labels).toHaveCount(2);
    await expect(labels.first()).toHaveText('2026-08-01');
    await expect(labels.last()).toHaveText('2026-08-03');
  });
});

test.describe('toggleTrafficHistory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('fetches, filters to monitored repos, and renders on first open', async ({ page }) => {
    const csv = [
      'repo,date,views,unique_visitors',
      'ScottKirvan/Smokey,2026-09-01,10,3',
      'ScottKirvan/NotMonitored,2026-09-01,99,9',
    ].join('\n');

    await page.evaluate((csv) => {
      S.repos = ['ScottKirvan/Smokey'];
      window.fetch = async (url) => {
        if (String(url).includes('traffic-log/views.csv')) {
          return { ok: true, text: async () => csv };
        }
        return { ok: false, status: 404 };
      };
    }, csv);

    await page.click('#historyToggle');

    await expect(page.locator('#historyChartWrap')).toBeVisible();
    await expect(page.locator('#historyToggle')).toHaveText('Hide full history ▴');
    await expect(page.locator('#historyTotal')).toHaveText('10 views · 3 unique · 1 days');
  });

  test('does not refetch on a second open — uses the cached result', async ({ page }) => {
    const fetchCount = await page.evaluate(async () => {
      S.repos = ['ScottKirvan/Smokey'];
      let calls = 0;
      window.fetch = async () => {
        calls++;
        return { ok: true, text: async () => 'repo,date,views,unique_visitors\nScottKirvan/Smokey,2026-09-01,1,1\n' };
      };
      // toggleTrafficHistory() is a fire-and-forget onclick handler — it
      // doesn't return loadTrafficHistory()'s promise, so awaiting it
      // wouldn't actually wait for the fetch to finish. Drive the first
      // load directly and await it for a deterministic starting state,
      // then use the toggle for the close/reopen this test is about.
      document.getElementById('historyChartWrap').hidden = false;
      await loadTrafficHistory();
      toggleTrafficHistory(); // close
      toggleTrafficHistory(); // reopen — should use the cache, not refetch
      return calls;
    });

    expect(fetchCount).toBe(1);
  });

  test('shows a message when the log branch has no file yet (404)', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = async () => ({ ok: false, status: 404 });
    });

    await page.click('#historyToggle');

    await expect(page.locator('#historyEmpty')).toHaveText('No history data found yet.');
  });
});
