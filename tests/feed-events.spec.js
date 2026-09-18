// @ts-check
const { test, expect } = require('@playwright/test');

// mapEvent() backs the activity feed ticker (ddc448e) and had no direct
// test coverage for its per-event-type verb/url mapping.

function baseEvent(overrides) {
  return {
    id: '1',
    repo: { name: 'ScottKirvan/Smokey' },
    created_at: '2026-01-01T00:00:00Z',
    payload: {},
    ...overrides,
  };
}

test.describe('mapEvent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('PushEvent describes the commit count', async ({ page }) => {
    const item = await page.evaluate((ev) => mapEvent(ev), baseEvent({
      type: 'PushEvent',
      payload: { size: 3, commits: [1, 2, 3] },
    }));
    expect(item.verb).toBe('pushed 3 commits');
    expect(item.repoName).toBe('Smokey');
    expect(item.url).toBe('https://github.com/ScottKirvan/Smokey/commits');
  });

  test('PushEvent uses singular "commit" for a single push', async ({ page }) => {
    const item = await page.evaluate((ev) => mapEvent(ev), baseEvent({
      type: 'PushEvent',
      payload: { size: 1 },
    }));
    expect(item.verb).toBe('pushed 1 commit');
  });

  test('a merged PullRequestEvent says "merged" rather than the raw action', async ({ page }) => {
    const item = await page.evaluate((ev) => mapEvent(ev), baseEvent({
      type: 'PullRequestEvent',
      payload: { action: 'closed', pull_request: { merged: true, number: 14, html_url: 'https://github.com/x/y/pull/14' } },
    }));
    expect(item.verb).toBe('merged PR #14');
    expect(item.url).toBe('https://github.com/x/y/pull/14');
  });

  test('CreateEvent for a new repository is skipped (returns null)', async ({ page }) => {
    const item = await page.evaluate((ev) => mapEvent(ev), baseEvent({
      type: 'CreateEvent',
      payload: { ref_type: 'repository' },
    }));
    expect(item).toBeNull();
  });

  test('CreateEvent for a branch links to the tree view', async ({ page }) => {
    const item = await page.evaluate((ev) => mapEvent(ev), baseEvent({
      type: 'CreateEvent',
      payload: { ref_type: 'branch', ref: 'feat/x' },
    }));
    expect(item.verb).toBe('created branch feat/x');
    expect(item.url).toBe('https://github.com/ScottKirvan/Smokey/tree/feat%2Fx');
  });

  test('WatchEvent renders as "starred"', async ({ page }) => {
    const item = await page.evaluate((ev) => mapEvent(ev), baseEvent({ type: 'WatchEvent' }));
    expect(item.verb).toBe('starred');
  });
});

test.describe('activity feed marquee rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  const fakeItems = () => Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    icon: '<svg></svg>',
    repoName: 'Smokey',
    verb: 'pushed 1 commit',
    url: 'https://github.com/ScottKirvan/Smokey',
    createdAt: new Date().toISOString(),
  }));

  test('stays hidden when the feed is disabled, even with items queued', async ({ page }) => {
    await page.evaluate((items) => {
      S.showFeed = false;
      S.pat = 'fake-pat';
      S.feedItems = items;
      renderFeed();
    }, fakeItems());
    await expect(page.locator('#feedSection')).toBeHidden();
  });

  test('doubles the chip set for a seamless scroll loop when shown', async ({ page }) => {
    await page.evaluate((items) => {
      S.showFeed = true;
      S.pat = 'fake-pat';
      S.feedItems = items;
      renderFeed();
    }, fakeItems());

    await expect(page.locator('#feedSection')).toBeVisible();
    await expect(page.locator('.feed-chip')).toHaveCount(6); // 3 items x 2
  });

  test('shows up to 10 items, not just 5', async ({ page }) => {
    const items = Array.from({ length: 14 }, (_, i) => ({
      id: String(i),
      icon: '<svg></svg>',
      repoName: 'Smokey',
      verb: 'pushed 1 commit',
      url: 'https://github.com/ScottKirvan/Smokey',
      createdAt: new Date().toISOString(),
    }));
    await page.evaluate((items) => {
      S.showFeed = true;
      S.pat = 'fake-pat';
      S.feedItems = items;
      renderFeed();
    }, items);

    await expect(page.locator('.feed-chip')).toHaveCount(20); // 10 shown x 2
  });

  test('scrolls at 2x the original baseline speed', async ({ page }) => {
    await page.evaluate((items) => {
      S.showFeed = true;
      S.pat = 'fake-pat';
      S.feedItems = items;
      renderFeed();
    }, fakeItems());

    const dur = await page.locator('.feed-inner').first()
      .evaluate(el => el.style.animationDuration);
    expect(dur).toBe('9s'); // 3 items x 3s/item — half of the pre-speedup 3 x 6s = 18s
  });

  // Regression test for deaf8d4 "remove feed marquee hover-pause entirely" —
  // the strip previously paused on hover in a way that got stuck after tab
  // switches (505b385, 27baece); it now never pauses at all.
  test('does not pause the scroll animation on hover', async ({ page }) => {
    await page.evaluate((items) => {
      S.showFeed = true;
      S.pat = 'fake-pat';
      S.feedItems = items;
      renderFeed();
    }, fakeItems());

    const inner = page.locator('.feed-inner');
    // force: true — the element is continuously translating by design, so
    // Playwright's "wait until stable" actionability check would otherwise
    // never resolve. force skips that wait but still moves the pointer over
    // the element, which is all a hover-pause regression needs.
    await inner.hover({ force: true });
    const playState = await inner.evaluate(el => getComputedStyle(el).animationPlayState);
    expect(playState).toBe('running');
  });
});
