// @ts-check
const { test, expect } = require('@playwright/test');

// Covers 75535cc "add PWA support (manifest, service worker, icons)" — none
// of the three pieces had any check that they actually stay wired together.

test.describe('PWA support', () => {
  test.use({ serviceWorkers: 'allow' }); // the rest of the suite blocks it (playwright.config.js)

  test('manifest.json is valid and linked from index.html', async ({ page, request }) => {
    await page.goto('/index.html');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const res = await request.get(new URL(href, page.url()).toString());
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();

    expect(manifest.name).toBe('Smokey');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('every icon listed in the manifest actually loads', async ({ page, request }) => {
    await page.goto('/index.html');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(new URL(href, page.url()).toString())).json();

    for (const icon of manifest.icons) {
      const res = await request.get(new URL(icon.src, page.url()).toString());
      expect(res.ok(), `icon ${icon.src} should load`).toBeTruthy();
    }
  });

  test('registers the service worker on load', async ({ page }) => {
    const registered = [];
    await page.addInitScript(() => {
      if (!('serviceWorker' in navigator)) return;
      const realRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (url, opts) => {
        window.__swRegisterCalls = window.__swRegisterCalls || [];
        window.__swRegisterCalls.push(String(url));
        return realRegister(url, opts);
      };
    });

    await page.goto('/index.html');
    await page.waitForFunction(() => Array.isArray(window.__swRegisterCalls) && window.__swRegisterCalls.length > 0);
    const calls = await page.evaluate(() => window.__swRegisterCalls);
    expect(calls).toContain('./sw.js');
  });

  test('sw.js itself is served and parses as valid JavaScript', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(() => new Function(body)).not.toThrow();
  });
});
