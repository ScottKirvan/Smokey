// @ts-check
const { test, expect } = require('@playwright/test');

// Private repos get a lock icon to the left of the name so they're
// distinguishable from public ones at a glance in the table.

test.describe('fetchRepo captures visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('carries the repo.private field through into the row data', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const realFetch = window.fetch;
      window.fetch = async (url) => {
        if (String(url).endsWith('/repos/owner/secret')) {
          return {
            ok: true,
            headers: { get: () => null },
            json: async () => ({ full_name: 'owner/secret', pushed_at: '2026-01-01T00:00:00Z', private: true }),
          };
        }
        if (String(url).includes('/releases/latest')) return { ok: false, status: 404 };
        if (String(url).includes('/pulls'))           return { ok: true, json: async () => [] };
        if (String(url).includes('/issues'))          return { ok: true, json: async () => [] };
        return { ok: false, status: 404 };
      };
      try {
        return await fetchRepo('owner/secret', {});
      } finally {
        window.fetch = realFetch;
      }
    });

    expect(result.private).toBe(true);
  });
});

test.describe('rowHTML lock icon', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  const baseRepo = {
    full_name: 'owner/repo', pushed_at: '2026-01-01T00:00:00Z',
    open_prs: 0, external_prs: 0, open_issues: 0, external_issues: 0,
    latest_release: null,
  };

  test('renders a lock icon for a private repo', async ({ page }) => {
    const html = await page.evaluate((d) => rowHTML(d), { ...baseRepo, private: true });
    expect(html).toContain('lock-icon');
  });

  test('renders no lock icon for a public repo', async ({ page }) => {
    const html = await page.evaluate((d) => rowHTML(d), { ...baseRepo, private: false });
    expect(html).not.toContain('lock-icon');
  });
});
