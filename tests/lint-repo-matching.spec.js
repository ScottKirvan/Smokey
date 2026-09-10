// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Static guard against the repo-rename bug class documented in
// repo-rename-drift.spec.js: index.html must never compare a raw S.repos
// config string directly against a GitHub-resolved canonical name (a
// `.full_name` field, an Events-API `repo.name`, a traffic-log CSV `repo`
// column, etc.) to filter or match data. A repo renamed on GitHub after
// being added to Settings makes the two differ — GitHub itself still
// redirects the old name for most endpoints, so the bug is silent: no
// error, just data that quietly stops showing up for that one repo. The
// fix is always the same: match against the canonical full_name already
// resolved into S.data (see loadTraffic() and pollEvents() for the
// correct pattern), not against S.repos directly.
//
// This has recurred three times already (pollEvents, load()'s CI-status
// merge, loadTraffic()) — each in a different function, each looking
// harmless in isolation. Hence a source-level check rather than relying on
// reviewers to remember the whole history.

test('index.html never matches S.repos entries directly against a resolved repo name', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  // Shape 1: using S.repos as a membership test against externally-sourced
  // rows (CSV rows, event payloads, ...). Caught the loadTraffic() bug.
  expect(src).not.toMatch(/S\.repos\.includes\(/);

  // Shape 2: iterating S.repos and looking up the matching record by
  // `<something>.full_name === <raw S.repos string>`. Caught the
  // load()'s CI-status-merge bug.
  expect(src).not.toMatch(/\.find\([^)]*\.full_name\s*===\s*\w+\)/);
});
