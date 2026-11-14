// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// The Smokey bear (assets/media/Smokey-Head.png) is the app's icon everywhere:
// the browser tab, the installed web app, the iPhone home screen and the
// header's wordmark.

const ROOT = path.join(__dirname, '..');
const pngSize = file => {
  const b = fs.readFileSync(path.join(ROOT, file));
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
};

test('the manifest lists "any" icons and separate maskable ones, each the size it claims', () => {
  const { icons } = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  expect(icons.map(i => [i.src, i.sizes, i.purpose])).toEqual([
    ['icon-192.png', '192x192', 'any'],
    ['icon-512.png', '512x512', 'any'],
    ['icon-maskable-192.png', '192x192', 'maskable'],
    ['icon-maskable-512.png', '512x512', 'maskable'],
  ]);
  for (const i of icons) expect(pngSize(i.src)).toBe(i.sizes);
});

test('the service worker caches the favicon with the other shell files, all of which exist', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  expect(shell).toContain('./favicon.png');
  for (const f of shell.filter(f => f !== './')) expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
});

test.describe('in the page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
    await page.goto('/index.html');
  });

  test('the tab icon is the bear favicon', async ({ page }) => {
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'favicon.png');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('sizes', '64x64');
    expect(pngSize('favicon.png')).toBe('64x64');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icon-192.png');
  });

  test('the header shows the bear before the name, and keeps the status light', async ({ page }) => {
    const logo = page.locator('header .wordmark img.wordmark-logo');
    await expect(logo).toHaveAttribute('src', 'favicon.png');
    expect(await logo.evaluate(img => img.complete && img.naturalWidth === 64)).toBe(true);
    const order = await page.locator('header .wordmark').evaluate(w =>
      [...w.childNodes].filter(n => n.nodeType === 1 || n.textContent.trim())
        .map(n => n.nodeType === 1 ? (n.id || n.className) : n.textContent.trim()));
    expect(order).toEqual(['wordmark-logo', 'Smokey', 'pip']);
  });
});
