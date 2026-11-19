// @ts-check
const { test, expect } = require('@playwright/test');

// The Repo header is a four-state sort button: name ↑, name ↓, latest release
// ↑ (oldest first), latest release ↓ (newest first), then back to name ↑.
// While sorting by release the header reads "Release". Repos without a
// release sort after the ones with one, in both directions.

async function gotoQuiet(page) {
  await page.route(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//, r => r.abort());
  await page.goto('/index.html');
  await page.waitForFunction(() =>
    !document.getElementById('refreshBtn').classList.contains('spinning') && !issueLoading && !starLoading);
}

async function seed(page) {
  await page.evaluate(() => {
    const row = (name, rel) => ({ full_name: `ScottKirvan/${name}`, pushed_at: '2026-11-01T00:00:00Z', open_prs: 0, external_prs: 0,
      open_issues: 0, external_issues: 0, issue_split: { bug: 0, feat: 0, misc: 0 },
      latest_release: rel ? { tag_name: 'v1', published_at: rel } : null });
    S.data = [row('Bravo', '2026-03-01T00:00:00Z'), row('alpha', null), row('Delta', '2026-11-01T00:00:00Z'),
      row('Charlie', '2025-06-01T00:00:00Z'), row('Echo', null)];
    renderAll();
  });
}
const state = page => page.evaluate(() => ({
  by: S.sortBy, dir: S.sortDir,
  label: document.getElementById('lbl-name').textContent, arrow: document.getElementById('arr-name').textContent,
  rows: [...document.querySelectorAll('#tbody .repo-link')].map(a => a.textContent.trim()),
}));

test.describe('Repo header: four-state sort', () => {
  test.beforeEach(async ({ page }) => { await gotoQuiet(page); await seed(page); });

  test('cycles name ↑, name ↓, release ↑, release ↓, then back to name ↑', async ({ page }) => {
    const steps = [];
    for (let i = 0; i < 5; i++) { await page.click('#th-name'); steps.push(await state(page)); }
    expect(steps).toEqual([
      { by: 'name', dir: 'asc', label: 'Repo', arrow: '↑', rows: ['alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'] },
      { by: 'name', dir: 'desc', label: 'Repo', arrow: '↓', rows: ['Echo', 'Delta', 'Charlie', 'Bravo', 'alpha'] },
      { by: 'release', dir: 'asc', label: 'Release', arrow: '↑', rows: ['Charlie', 'Bravo', 'Delta', 'alpha', 'Echo'] },
      { by: 'release', dir: 'desc', label: 'Release', arrow: '↓', rows: ['Delta', 'Bravo', 'Charlie', 'alpha', 'Echo'] },
      { by: 'name', dir: 'asc', label: 'Repo', arrow: '↑', rows: ['alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'] },
    ]);
  });

  test('the header is marked active in every state, and another column resets it to Repo', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.click('#th-name');
    await expect(page.locator('#th-name')).toHaveClass(/active/);
    await page.click('#th-issues');
    const s = await state(page);
    expect([s.by, s.label, s.arrow]).toEqual(['issues', 'Repo', '']);
    await expect(page.locator('#th-name')).not.toHaveClass(/active/);
  });

  test('sorting by release is remembered across a reload', async ({ page }) => {
    for (let i = 0; i < 4; i++) await page.click('#th-name');
    await gotoQuiet(page);
    await seed(page);
    const s = await state(page);
    expect([s.by, s.dir, s.label, s.arrow]).toEqual(['release', 'desc', 'Release', '↓']);
  });
});
