// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

// The About dialog (#4) copies BojuBot's About modal (src/modals/AboutModal.ts
// there): logo, name, a click-to-copy version block, link cards, and small
// icon links in the footer.

const ROOT = path.join(__dirname, '..');
const VERSION = fs.readFileSync(path.join(ROOT, 'notes/VERSION.md'), 'utf8').match(/version=(\S+)/)[1];

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
}

test.describe('About dialog', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('opens from the header and shows the logo, name and current version', async ({ page }) => {
    await expect(page.locator('#aboutOverlay')).toBeHidden();
    await page.locator('header button[title="About Smokey"]').click();
    await expect(page.locator('#aboutOverlay')).toBeVisible();
    await expect(page.locator('.about-name')).toHaveText('Smokey');
    await expect(page.locator('.about-logo')).toHaveAttribute('src', 'assets/media/Smokey-Head.png');
    await expect(page.locator('.about-version')).toHaveText(`Version ${VERSION}`);
    // The bear head isn't square and has a transparent background, so it's shown
    // whole at the logo height instead of cropped into BojuBot's rounded square.
    const logo = await page.evaluate(() => {
      const img = document.querySelector('.about-logo');
      const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
      return { loaded: img.complete && img.naturalWidth > 0, h: r.height, ratio: r.width / r.height,
        natural: img.naturalWidth / img.naturalHeight, radius: cs.borderTopLeftRadius, fit: cs.objectFit };
    });
    expect(logo.loaded).toBe(true);
    expect(logo.h).toBe(144);
    expect(logo.ratio).toBeCloseTo(logo.natural, 2);
    expect(logo.radius).toBe('0px');
  });

  test('has four cards: Documentation, Discord, Report a problem and Support Smokey', async ({ page }) => {
    await page.evaluate(() => openAbout());
    const cards = await page.locator('.about-item').evaluateAll(rows => rows.map(r => {
      const a = r.querySelector('.about-item-btn');
      return {
        title: r.querySelector('.about-item-title').textContent,
        label: a.textContent, href: a.getAttribute('href'),
        accent: a.classList.contains('mod-cta'), target: a.target, rel: a.rel,
      };
    }));
    expect(cards).toEqual([
      { title: 'Documentation', label: 'Visit', href: 'https://github.com/ScottKirvan/Smokey#readme', accent: true, target: '_blank', rel: 'noopener' },
      { title: 'Get help on Discord', label: 'Join', href: 'https://discord.gg/TN6XJSNK5Y', accent: false, target: '_blank', rel: 'noopener' },
      { title: 'Report a problem', label: 'Report', href: 'https://github.com/ScottKirvan/Smokey/issues/new/choose', accent: false, target: '_blank', rel: 'noopener' },
      { title: 'Support Smokey', label: 'Give', href: 'https://github.com/sponsors/ScottKirvan', accent: false, target: '_blank', rel: 'noopener' },
    ]);
    await expect(page.locator('.about-item-icon svg')).toHaveCount(4);
  });

  test('the footer links to the changelog and the repo', async ({ page }) => {
    await page.evaluate(() => openAbout());
    const links = await page.locator('.about-footer-icon').evaluateAll(as => as.map(a => [a.getAttribute('aria-label'), a.getAttribute('href')]));
    expect(links).toEqual([
      ["What's new", 'https://github.com/ScottKirvan/Smokey/blob/main/notes/CHANGELOG.md'],
      ['GitHub', 'https://github.com/ScottKirvan/Smokey'],
    ]);
  });

  test('clicking the version copies version, browser, OS and how it is running', async ({ page }) => {
    await page.evaluate(() => {
      window.__copied = null;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied = t; } } });
      openAbout();
    });
    await page.locator('.about-copy').click();
    await expect.poll(() => page.evaluate(() => window.__copied)).toMatch(new RegExp(`^Smokey ${VERSION.replace(/\./g, '\\.')} · .+ · .+ · (installed app|browser tab)$`));
    await expect(page.locator('.about-version')).toHaveText('Copied to clipboard.');
  });

  test('closes with the X, with Escape, and with a click outside the panel, but not a click inside it', async ({ page }) => {
    const open = () => page.evaluate(() => openAbout());
    await open();
    await page.locator('.about-panel .close-btn').click();
    await expect(page.locator('#aboutOverlay')).toBeHidden();

    await open();
    await page.keyboard.press('Escape');
    await expect(page.locator('#aboutOverlay')).toBeHidden();

    await open();
    await page.locator('.about-name').click();
    await expect(page.locator('#aboutOverlay')).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.locator('#aboutOverlay')).toBeHidden();
  });
});

test.describe('clientParts', () => {
  test('an iPad reports iPadOS, though Safari on iPad identifies itself as a Mac', async ({ page }) => {
    await gotoQuiet(page);
    const ipadDesktopUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
    const out = await page.evaluate((ua) => [
      clientParts(ua, true, 5),
      clientParts(ua, false, 0),
      clientParts('Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', true, 5),
    ], ipadDesktopUA);
    expect(out).toEqual([
      ['Safari 18', 'iPadOS', 'installed app'],
      ['Safari 18', 'macOS', 'browser tab'],
      ['Safari 18', 'iPadOS', 'installed app'],
    ]);
  });


  test.beforeEach(async ({ page }) => { await gotoQuiet(page); });

  test('names the browser, OS and display mode', async ({ page }) => {
    const out = await page.evaluate(() => [
      clientParts('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', true),
      clientParts('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', false),
      clientParts('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', true),
      clientParts('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0', false),
    ]);
    expect(out).toEqual([
      ['Chrome 141', 'Android', 'installed app'],
      ['Edge 141', 'Windows', 'browser tab'],
      ['Safari 18', 'iOS', 'installed app'],
      ['Firefox 132', 'macOS', 'browser tab'],
    ]);
  });
});

test('release-please bumps the version shown in the About dialog', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, '.github/release-please/release-please-config.json'), 'utf8'));
  expect(config.packages['.']['extra-files']).toContain('index.html');
  const line = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n').find(l => l.includes('const APP_VERSION'));
  expect(line).toBe(`const APP_VERSION = '${VERSION}'; // x-release-please-version`);
});
