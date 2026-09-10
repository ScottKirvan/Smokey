// @ts-check
const { test, expect } = require('@playwright/test');

// A second ticker strip showing the user's unread GitHub notifications
// (GET /notifications). Unlike the activity feed, this is account-wide,
// not scoped to monitored repos, and only classic PATs can call the
// endpoint — fine-grained PATs are unsupported per GitHub's own docs.

function baseNotification(overrides) {
  return {
    id: '1',
    repository: { full_name: 'ScottKirvan/Smokey', html_url: 'https://github.com/ScottKirvan/Smokey' },
    subject: { title: 'Something happened', url: '', type: 'Issue' },
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test.describe('notifUrl', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('Issue subject urls translate directly to the web path', async ({ page }) => {
    const url = await page.evaluate((n) => notifUrl(n), baseNotification({
      subject: { title: 'x', type: 'Issue', url: 'https://api.github.com/repos/o/r/issues/12' },
    }));
    expect(url).toBe('https://github.com/o/r/issues/12');
  });

  test('PullRequest subject urls swap the plural API segment for the singular web one', async ({ page }) => {
    const url = await page.evaluate((n) => notifUrl(n), baseNotification({
      subject: { title: 'x', type: 'PullRequest', url: 'https://api.github.com/repos/o/r/pulls/12' },
    }));
    expect(url).toBe('https://github.com/o/r/pull/12');
  });

  test('Commit subject urls swap the plural API segment for the singular web one', async ({ page }) => {
    const url = await page.evaluate((n) => notifUrl(n), baseNotification({
      subject: { title: 'x', type: 'Commit', url: 'https://api.github.com/repos/o/r/commits/abc123' },
    }));
    expect(url).toBe('https://github.com/o/r/commit/abc123');
  });

  test('falls back to the repo page for a type with no reliable web-url mapping', async ({ page }) => {
    const url = await page.evaluate((n) => notifUrl(n), baseNotification({
      subject: { title: 'x', type: 'Release', url: 'https://api.github.com/repos/o/r/releases/9' },
      repository: { full_name: 'o/r', html_url: 'https://github.com/o/r' },
    }));
    expect(url).toBe('https://github.com/o/r');
  });
});

test.describe('mapNotification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('extracts repo name, title, a resolved url, and the updated_at timestamp', async ({ page }) => {
    const item = await page.evaluate((n) => mapNotification(n), baseNotification({
      subject: { title: 'Fix the thing', type: 'Issue', url: 'https://api.github.com/repos/ScottKirvan/Smokey/issues/7' },
      updated_at: '2026-03-04T00:00:00Z',
    }));
    expect(item.repoName).toBe('Smokey');
    expect(item.title).toBe('Fix the thing');
    expect(item.url).toBe('https://github.com/ScottKirvan/Smokey/issues/7');
    expect(item.updatedAt).toBe('2026-03-04T00:00:00Z');
  });
});

test.describe('pollNotifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('fetches unread notifications with per_page=100 and renders them', async ({ page }) => {
    const result = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.showNotifs = true;
      S.notifItems = [];
      S.notifLastModified = '';
      let requestedUrl = null;

      const realFetch = window.fetch;
      window.fetch = async (url) => {
        requestedUrl = String(url);
        if (requestedUrl === 'https://api.github.com/notifications?per_page=100') {
          return {
            ok: true, status: 200,
            headers: { get: (k) => k === 'Last-Modified' ? 'Wed, 01 Jan 2026 00:00:00 GMT' : null },
            json: async () => ([{
              id: '1',
              repository: { full_name: 'ScottKirvan/Smokey', html_url: 'https://github.com/ScottKirvan/Smokey' },
              subject: { title: 'Fix the thing', type: 'Issue', url: 'https://api.github.com/repos/ScottKirvan/Smokey/issues/7' },
              updated_at: '2026-01-01T00:00:00Z',
            }]),
          };
        }
        return { ok: false, status: 404 };
      };
      try {
        await pollNotifications();
      } finally {
        window.fetch = realFetch;
      }
      return { requestedUrl, notifItems: S.notifItems };
    });

    expect(result.requestedUrl).toBe('https://api.github.com/notifications?per_page=100');
    expect(result.notifItems).toHaveLength(1);
    expect(result.notifItems[0].repoName).toBe('Smokey');
  });

  test('keeps every unread notification the poll returns, not just the first 10', async ({ page }) => {
    const notifItems = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.notifItems = [];
      S.notifLastModified = '';

      window.fetch = async () => ({
        ok: true, status: 200,
        headers: { get: () => null },
        json: async () => Array.from({ length: 12 }, (_, i) => ({
          id: String(i),
          repository: { full_name: 'ScottKirvan/Smokey', html_url: 'https://github.com/ScottKirvan/Smokey' },
          subject: { title: `item ${i}`, type: 'Issue', url: `https://api.github.com/repos/ScottKirvan/Smokey/issues/${i}` },
          updated_at: '2026-01-01T00:00:00Z',
        })),
      });
      await pollNotifications();
      return S.notifItems;
    });

    expect(notifItems).toHaveLength(12);
  });

  test('does nothing on a 304 (nothing changed since the last poll)', async ({ page }) => {
    const notifItems = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.notifItems = [{ id: 'stale' }];
      window.fetch = async () => ({ ok: false, status: 304 });
      await pollNotifications();
      return S.notifItems;
    });
    expect(notifItems).toEqual([{ id: 'stale' }]);
  });

  test('does nothing without a PAT', async ({ page }) => {
    const called = await page.evaluate(async () => {
      S.pat = '';
      let fetchCalled = false;
      window.fetch = async () => { fetchCalled = true; return { ok: false, status: 401 }; };
      await pollNotifications();
      return fetchCalled;
    });
    expect(called).toBe(false);
  });
});

test.describe('notifications ticker rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  const fakeItems = () => Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    icon: '<svg></svg>',
    repoName: 'Smokey',
    title: 'Fix the thing',
    url: 'https://github.com/ScottKirvan/Smokey/issues/7',
  }));

  test('stays hidden when notifications are disabled, even with items queued', async ({ page }) => {
    await page.evaluate((items) => {
      S.showNotifs = false;
      S.pat = 'fake-pat';
      S.notifItems = items;
      renderNotifFeed();
    }, fakeItems());
    await expect(page.locator('#notifSection')).toBeHidden();
  });

  test('doubles the chip set for a seamless scroll loop when shown', async ({ page }) => {
    await page.evaluate((items) => {
      S.showNotifs = true;
      S.pat = 'fake-pat';
      S.notifItems = items;
      renderNotifFeed();
    }, fakeItems());

    await expect(page.locator('#notifSection')).toBeVisible();
    await expect(page.locator('#notifRow .feed-chip')).toHaveCount(6); // 3 items x 2
  });

  test('shows a relative-time timestamp in each chip, like the activity feed does', async ({ page }) => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    await page.evaluate((updatedAt) => {
      S.showNotifs = true;
      S.pat = 'fake-pat';
      S.notifItems = [{
        id: '1', icon: '<svg></svg>', repoName: 'Smokey', title: 'Fix the thing',
        url: 'https://github.com/ScottKirvan/Smokey/issues/7', updatedAt,
      }];
      renderNotifFeed();
    }, fiveMinAgo);

    await expect(page.locator('#notifRow .feed-chip').first()).toContainText('m ago');
  });

  test('shows every unread notification, not just the first 5', async ({ page }) => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      icon: '<svg></svg>',
      repoName: 'Smokey',
      title: `item ${i}`,
      url: 'https://github.com/ScottKirvan/Smokey/issues/1',
    }));
    await page.evaluate((items) => {
      S.showNotifs = true;
      S.pat = 'fake-pat';
      S.notifItems = items;
      renderNotifFeed();
    }, items);

    await expect(page.locator('#notifRow .feed-chip')).toHaveCount(16); // 8 items x 2
  });

  test('the ALERTS label links to the GitHub notifications inbox', async ({ page }) => {
    const href = await page.locator('#notifSection a.feed-label').getAttribute('href');
    expect(href).toBe('https://github.com/notifications');
  });
});
