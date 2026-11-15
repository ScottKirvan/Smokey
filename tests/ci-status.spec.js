// @ts-check
const { test, expect } = require('@playwright/test');

// The dot is the color of the newest workflow run only. The other workflows
// (newest run of each, from the same 10 runs) show as a "!" next to it when
// any of them isn't green, colored by the worst of them. Before, the dot was
// the worst of all of them, so an old failure in one workflow hid that the
// latest run passed.

function run(name, conclusion, status) {
  return { name, conclusion, status };
}

async function classify(page, workflowRuns) {
  return page.evaluate(async (runs) => {
    const realFetch = window.fetch;
    window.fetch = async () => ({ ok: true, json: async () => ({ workflow_runs: runs }) });
    try {
      return await fetchWorkflowRuns('owner/repo', {});
    } finally {
      window.fetch = realFetch;
    }
  }, workflowRuns);
}

test.describe('CI workflow run classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('the dot is the newest run\'s color, not the worst workflow\'s', async ({ page }) => {
    const result = await classify(page, [
      run('build', 'success', 'completed'),
      run('deploy', 'failure', 'completed'),
    ]);
    expect(result.level).toBe('green');
    expect(result.others).toBe('red');
  });

  test('a failing newest run is red even when the others are green', async ({ page }) => {
    const result = await classify(page, [
      run('deploy', 'failure', 'completed'),
      run('build', 'success', 'completed'),
    ]);
    expect(result.level).toBe('red');
    expect(result.others).toBeNull();
  });

  test('the others take their worst color: red outranks ice and yellow', async ({ page }) => {
    const result = await classify(page, [
      run('build', 'success', 'completed'),
      run('test', null, 'queued'),             // yellow
      run('lint', null, 'waiting'),            // ice
      run('deploy', 'timed_out', 'completed'), // red
    ]);
    expect(result.others).toBe('red');
  });

  test('ice (blocked/waiting) outranks yellow among the others when nothing is red', async ({ page }) => {
    const result = await classify(page, [
      run('build', null, 'in_progress'),      // yellow, the newest
      run('test', null, 'in_progress'),       // yellow
      run('deploy', null, 'action_required'), // ice
    ]);
    expect(result.level).toBe('yellow');
    expect(result.others).toBe('ice');
  });

  test('all-success workflows classify as green with no others flag', async ({ page }) => {
    const result = await classify(page, [
      run('build', 'success', 'completed'),
      run('deploy', 'neutral', 'completed'),
      run('lint', 'skipped', 'completed'),
    ]);
    expect(result.level).toBe('green');
    expect(result.others).toBeNull();
  });

  test('dedupes by workflow name, keeping only the newest run per workflow', async ({ page }) => {
    // The API returns newest-first; an older failing "deploy" run must not
    // count once a newer, successful "deploy" run has been seen, and an older
    // run of the newest run's own workflow isn't one of "the others".
    const result = await classify(page, [
      run('deploy', 'success', 'completed'),
      run('build', 'success', 'completed'),
      run('deploy', 'failure', 'completed'),
    ]);
    expect(result.level).toBe('green');
    expect(result.others).toBeNull();
    expect(result.workflows).toHaveLength(2);
    expect(result.workflows.map(w => w.name).sort()).toEqual(['build', 'deploy']);
  });

  test('no workflow runs classifies as none', async ({ page }) => {
    const result = await classify(page, []);
    expect(result).toEqual({ level: 'none', others: null, workflows: [] });
  });

  test('a failed API response yields null rather than throwing', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const realFetch = window.fetch;
      window.fetch = async () => ({ ok: false });
      try {
        return await fetchWorkflowRuns('owner/repo', {});
      } finally {
        window.fetch = realFetch;
      }
    });
    expect(result).toBeNull();
  });
});

test.describe('CI cell rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('shows a plain dot with a PAT hint when no PAT is configured', async ({ page }) => {
    const html = await page.evaluate(() => {
      S.pat = '';
      return ciCellHTML({ ci: null });
    });
    expect(html).toContain('Add a PAT in Settings');
    expect(html).not.toContain('ci-red');
  });

  test('renders the level-specific dot class once a PAT is set', async ({ page }) => {
    const html = await page.evaluate(() => {
      S.pat = 'fake-pat';
      return ciCellHTML({
        full_name: 'owner/repo',
        ci: { level: 'red', workflows: [{ name: 'deploy', conclusion: 'failure' }] },
      });
    });
    expect(html).toContain('ci-red');
    expect(html).toContain('deploy');
  });

  test('adds a "!" in the others\' color when another workflow isn\'t green', async ({ page }) => {
    const cell = await page.evaluate(() => {
      S.pat = 'fake-pat';
      const td = document.createElement('tr');
      document.querySelector('#tbody').appendChild(td);
      td.innerHTML = ciCellHTML({ full_name: 'owner/repo', ci: { level: 'green', others: 'red',
        workflows: [{ name: 'build', conclusion: 'success' }, { name: 'deploy', conclusion: 'failure' }] } });
      const bang = td.querySelector('.ci-bang');
      return { dot: td.querySelector('.ci-dot').className, bang: bang?.className, text: bang?.textContent,
        color: bang && getComputedStyle(bang).color, red: getComputedStyle(document.documentElement).getPropertyValue('--ext').trim() };
    });
    expect(cell.dot).toBe('ci-dot ci-green');
    expect(cell.bang).toBe('ci-bang ci-bang-red');
    expect(cell.text).toBe('!');
    const hex = '#' + cell.color.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(cell.red);
  });

  test('no "!" when the others are all green', async ({ page }) => {
    const html = await page.evaluate(() => {
      S.pat = 'fake-pat';
      return ciCellHTML({ full_name: 'owner/repo', ci: { level: 'red', others: null, workflows: [{ name: 'deploy', conclusion: 'failure' }] } });
    });
    expect(html).not.toContain('ci-bang');
  });

  test('the tooltip marks which run the dot shows', async ({ page }) => {
    const tip = await page.evaluate(() => ciTooltip({ level: 'green', others: 'red',
      workflows: [{ name: 'build', conclusion: 'success' }, { name: 'deploy', conclusion: 'failure' }] }));
    expect(tip.split('\n')).toEqual(['✓ build (latest run)', '✗ deploy (failure)']);
  });

  test('sorts by the newest run, then by the others', async ({ page }) => {
    const order = await page.evaluate(() => {
      const r = (name, level, others) => ({ full_name: `o/${name}`, ci: { level, others, workflows: [] } });
      S.sortBy = 'ci'; S.sortDir = 'asc';
      return sortData([r('greenClean', 'green', null), r('greenRed', 'green', 'red'), r('red', 'red', null), r('greenYellow', 'green', 'yellow')])
        .map(d => d.full_name.slice(2));
    });
    expect(order).toEqual(['red', 'greenRed', 'greenYellow', 'greenClean']);
  });
});
