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

  test('extracts repo name, title, and a resolved url', async ({ page }) => {
    const item = await page.evaluate((n) => mapNotification(n), baseNotification({
      subject: { title: 'Fix the thing', type: 'Issue', url: 'https://api.github.com/repos/ScottKirvan/Smokey/issues/7' },
    }));
    expect(item.repoName).toBe('Smokey');
    expect(item.title).toBe('Fix the thing');
    expect(item.url).toBe('https://github.com/ScottKirvan/Smokey/issues/7');
  });
});

test.describe('pollNotifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('fetches unread notifications and renders them', async ({ page }) => {
    const notifItems = await page.evaluate(async () => {
      S.pat = 'fake-pat';
      S.showNotifs = true;
      S.notifItems = [];
      S.notifLastModified = '';

      const realFetch = window.fetch;
      window.fetch = async (url) => {
        if (String(url) === 'https://api.github.com/notifications') {
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
      return S.notifItems;
    });

    expect(notifItems).toHaveLength(1);
    expect(notifItems[0].repoName).toBe('Smokey');
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
});
