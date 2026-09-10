# CLAUDE.md — Smokey

## Project

Smokey is a single-page GitHub repo health dashboard — installable as a PWA, no build step.

**GitHub repo:** `ScottKirvan/Smokey` (public)  
**Owner:** Scott Kirvan (anthropic@skvfx.com)  
**Live app:** served directly from `index.html` on GitHub Pages

### Architecture

`index.html` is the entire application — all HTML, CSS, and JS inline, with no module wrapper, so every top-level function (`sortData`, `aggregateTrafficHistory`, `fetchWorkflowRuns`, `mapEvent`, etc.) is reachable as a global in the browser. There is no bundler and no transpilation. `sw.js` handles PWA offline caching. `manifest.json` is the PWA manifest. The shipped app has no build step — do not introduce one.

`package.json` exists solely for the dev-time Playwright test suite (see Testing below); it is not involved in how the app is built or served.

### Testing

Playwright Test drives the real `index.html` in a headless browser — no build step, no mocked DOM. `npm test` runs the suite (`npm run serve` starts the same zero-dependency static server standalone, at `scripts/serve.js`, for manual poking). Tests call the page's global functions directly via `page.evaluate` for pure logic (classification, aggregation, event mapping), and drive the DOM/localStorage for behavioral checks (sort persistence, feed rendering). CI runs the suite on every push and PR (`.github/workflows/test.yml`).

### State model

All runtime state lives in a single `S` object at the top of the inline script:

```js
const S = {
  pat, repos, showOrg, showFeed, showNotifs,       // persisted to localStorage
  currentUser, loadedAt,                           // derived at load time
  data,                                            // fetched repo metadata
  feedItems, feedEtag, feedPollTimer,              // event feed
  notifItems, notifLastModified, notifPollTimer,   // notifications ticker
  rateLimit,                                       // { limit, remaining, reset } — GitHub API quota
};
```

localStorage keys: `rw_pat`, `rw_repos`, `rw_show_org`, `rw_feed`, `rw_notifs`, `rw_sort_by`, `rw_sort_dir`.

### Key features

- **Repo table** — sortable: name, visibility, last push, open issues, stars, latest release, CI status. Private repos show a lock icon to the left of the name (`d.private`, from the `/repos/{owner}/{repo}` response — set in `fetchRepo()`, rendered in `rowHTML()`).
- **CI status dots** — PAT-gated; color-coded per latest workflow run. Calls `/repos/{owner}/{repo}/actions/runs?per_page=10`. Dedupes by workflow name (newest per workflow). Classification:
  - `CI_RED` (`failure`, `timed_out`, `startup_failure`) — red glow
  - `CI_ICE` (`waiting`, `pending`, `action_required`) — cyan `--ice` glow (blocked/waiting for approval)
  - `CI_YELLOW` (`cancelled`, `in_progress`, `queued`) — yellow, no glow
  - Green (`success`, `neutral`, `skipped`) — green glow
- **Traffic chart** — full history, not just GitHub's 14-day live-API window. `loadTraffic()` fetches `views.csv` from the `traffic-log` branch (`raw.githubusercontent.com/ScottKirvan/Smokey/traffic-log/views.csv`) — a daily snapshot accumulated by a separate weekly GitHub Actions workflow (`log-traffic.yml`, using the `TRAFFIC_PAT` repo secret), unbounded by GitHub's 14-day API window (which itself can lag by more than a day — "yesterday" showing 0 was a real, confirmed API gap, not a bug). Filtered to `S.repos` (currently-monitored repos), aggregated by calendar date, fed into `renderChart()`. No PAT involved — the CSV is a public file; doesn't touch the "PAT sent only to api.github.com" constraint, and the chart now works with no PAT at all. `renderChart()`'s log x-axis / sqrt y-axis scaling is unchanged from the original 14-day-only chart — both were already parameterized by `data.length`, so the same math applies to the longer, growing range. Axis labels are the oldest/newest dates in the data rather than fixed relative labels.
- **Event feed ticker** — continuous CSS marquee strip below the traffic chart. Polls `/users/{username}/events` every 60 s using ETag conditional requests (respects `X-Poll-Interval: 60`). Shows 5 most recent events across monitored repos; deduplicates PushEvents within 5-min windows. PAT-gated, opt-in via Settings toggle. CSS: doubled chip set + `translateX(0 → -50%)` keyframe for seamless loop.
- **Notifications ticker** — second marquee strip below the event feed, sharing its CSS mechanics (doubled chip set, same scroll keyframe). Its "ALERTS" label links out to `github.com/notifications`. Polls `GET /notifications?per_page=100` every 60 s using `Last-Modified` / `If-Modified-Since` conditional requests (per GitHub's docs — this endpoint uses `Last-Modified`, not ETag, unlike the events endpoint above). Shows every unread notification the poll returns — unlike the event feed's 5-item cap, there's no truncation here; `per_page=100` (GitHub's max for this endpoint) is the only limit, not paginated further. Unlike the event feed, this is account-wide, not filtered to `S.repos` — it's GitHub's own unread-notifications inbox (`all=false` is the API default). Only classic PATs can call this endpoint; fine-grained PATs are unsupported per GitHub's docs, and it needs the `notifications` or `repo` scope. PAT-gated, opt-in via its own Settings toggle (`S.showNotifs` / `rw_notifs`), independent of the event feed toggle.
- **Rate limit bar** — footer bar below the table showing GitHub API quota used this hour and reset countdown. Reads the `X-RateLimit-*` headers GitHub returns on every API response (even errors, authenticated or not) rather than making a dedicated call — captured off the per-repo fetch in `fetchRepo()` and the feed poll in `pollEvents()`. Countdown text also refreshes on the existing 60s `updateSummaryTime` tick from cached state, no extra network call.

### Security constraint — must be preserved

The PAT is stored **only** in `localStorage` and sent **only** to `api.github.com`. It is never transmitted to any other origin. Do not add code that sends the PAT elsewhere.

### CSS token system

Theme-aware via CSS custom properties on `:root` (dark default) and `@media (prefers-color-scheme: light)`:

| Token      | Dark      | Light     | Purpose                  |
| ---------- | --------- | --------- | ------------------------ |
| `--accent` | `#2f81f7` | `#0969da` | Primary interactive blue |
| `--ice`    | `#58d4e8` | `#0891b2` | Blocked/waiting CI state |
| `--good`   | `#3fb950` | `#1a7f37` | Success / healthy        |
| `--warn`   | `#d29922` | `#9a6700` | Warning / in-progress    |
| `--ext`    | `#f85149` | `#cf222e` | Failure / stale          |

### Branching exception

Scott has granted explicit permission to commit and push directly to `main` for routine fixes and features. The general "never push to main" rule in the conventions below does not apply to this repo.

As of 2026-09-06, default to committing straight to `main` rather than branch+PR — this is a fun, low-stakes repo for Scott. Use branch+PR again only if he says otherwise.

---

## Keeping This File Current

This file is the primary context for any agent working in this repo — keep it accurate
as the project evolves. When you learn what the project is, add a brief description at
the top. As key files, build commands, and architectural decisions emerge, record them
here so future sessions start with full context rather than re-deriving it.

Update this file in the same commit as the work it documents.

## Working Conventions

- Never commit or push directly to `main`. Always branch first, then PR.
- Branch names must describe the work (e.g. `fix/login-timeout`, `feat/export-csv`).
  No random characters, UUIDs, or generated suffixes to ensure uniqueness — if a name
  is already taken, pick a more specific descriptive name instead.
- If a branch name is pre-assigned by tooling (a hosted agent session, a CI runner)
  rather than chosen by you, verify it against this convention before the first push.
  Rename locally (`git branch -m <name>`) if it doesn't match — being handed a name
  isn't an exemption from the rule.
- One concern per branch and PR. If work naturally splits into independent problems,
  split the branches too — resist bundling unrelated changes into one PR.
- Conventional commits: `feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:`.
  Breaking: `feat!:`.
- `feat:` is for genuinely new user-facing capabilities only. Bug fixes and corrections
  use `fix:`, even when they close a tracked issue.
- Unit tests must be written alongside all new code. All bug fixes require red/green
  tests — a failing test that reproduces the bug, then the fix that makes it pass.
- CI, lint, and formatting must all pass before committing or opening a PR. Discover
  the project's commands from the CI config, `package.json`, `Makefile`, or equivalent
  — do not assume they match another project's toolchain.
- Prefer narrow, localised changes. Favour modularity that contains the blast radius
  of future edits — a fix or feature should not require touching unrelated parts of
  the codebase. If it does, that's a design signal worth surfacing.
- Refactoring is a first-class activity, not something to defer. Improve structure as
  you go rather than accumulating technical debt for a later pass.
- When working in unfamiliar domain territory, prefer primary sources — official docs,
  specs, RFCs — over general knowledge. Flag domain uncertainty explicitly rather than
  proceeding on an assumption.
- Default to writing no comments. Add one only when the *why* is non-obvious — a
  hidden constraint, a subtle invariant, a workaround for a specific bug. If code is
  hard to understand, the fix is clearer naming and structure, not a comment explaining
  what it does.

## No Shortcuts

Nothing is deferred without explicit permission from the user. A known issue is still
a bug — do not mark it "won't fix", "by design", or "out of scope" unilaterally.

If a library or package cannot meet the stated requirements, the answer is to find an
alternative or do the work from first principles — not to defer the requirement or
revise it to fit the limitation. The requirements define what the project needs; the
implementation serves the requirements, not the other way around.

## Change as Experiment

Work proceeds in small, verifiable, safe, directed steps — not a plan executed end to
end. Each step is small enough to evaluate on its own: land it, check whether it moved
things in the right direction, then decide the next step from what was just learned
rather than from what was originally guessed. Treat every change as an experiment with
a check at the end, not a commitment to a predetermined path.

## Verification Discipline

Never state that something works, is fixed, or is verified unless it was checked at
that exact moment with a command whose output is the actual basis for the claim — not
memory of an earlier check, not knowledge of what the code is supposed to do, and not
a sub-agent's self-report taken at face value. The standard is identical in both
directions: the skepticism applied to a sub-agent's "done" (see Sub-Agent Workflow)
applies just as much to Claude's own claims to the user.

Before reporting a task or verification as complete:
- State the concrete, checkable success criteria before running anything — specific
  facts ("a PR exists against branch X containing files A and B"), not a general
  expectation ("it should work").
- Check every criterion with a fresh command at the time of the claim, and cite its
  actual output as the basis for what's reported.
- If a task has multiple required scenarios (e.g. two code paths, or a dev environment
  and the real deployment target), track them explicitly and don't report the whole
  task done until every one has been checked — a passing sub-step is not a finished
  task.
- Report against the criteria list: state plainly what's verified and what isn't,
  rather than describing the completed part in success language and leaving gaps
  implicit.

## Communication

Ask questions in natural language. Never use a multiple choice / structured question
tool — including Claude Code's `AskUserQuestion` tool — if clarification is needed,
just ask directly in plain text. This is a project-wide preference, not a
per-session one: some interfaces render binned/multiple-choice questions poorly,
and forcing a question into fixed options loses the nuance an open question
would surface. Standard engineering practice is to ask a real question and read
a real answer, not to pick from a menu.

## Autonomy

Make implementation decisions independently — don't ask permission for technical
choices within the stated requirements. Escalate only when something would change
scope, defer a requirement, or contradict what the user has described as the goal.

A structural choice made while implementing a functional request — naming, module
boundaries, a relationship between two pieces — is mine to propose, but must be
flagged as a proposal, not written into this file, a spec, or code comments with the
same authority as something the user actually decided.

A description of a desired change is not, by itself, authorization to execute it. If a
message separates *what* to do from *when* ("I'll tell you when"), wait for the
explicit go-ahead before acting — even on a fully-specified, low-risk change.

**IF YOU CANNOT DO EXACTLY WHAT WAS ASKED — DUE TO A TECHNICAL CONSTRAINT OR ANY OTHER
REASON — STATE THE CONSTRAINT AND STOP.** Do not silently substitute an alternative and
proceed to implement it in the same turn. Naming the blocker is not itself permission
to pick a workaround; the user decides which alternative (if any) to pursue. This
applies even when the substitute seems obviously reasonable.

**Two-strike auto-comply.** If corrected twice on the same point, treat the second
correction as an automatic stop: comply immediately, with no further justification or
re-explanation. Don't make the user repeat themselves a third time or invoke a
stop-word to get compliance — repetition itself is the signal.

**Mark proposals as proposals.** Any architectural or structural choice made while
implementing — one not a direct restatement of something the user actually decided —
gets written into a spec, `CLAUDE.md`, or other persistent doc as `[Proposed —
unconfirmed]`, not plain declarative text carrying the same authority as a real
decision. Don't unmark your own proposal; only the user confirming it (or leaving it
alone) makes it settled.

## Attribution

No attribution of any kind in commit messages, PR bodies, or issue text — no
"Generated with", "Co-Authored-By", "Created by Claude", or any AI/tool credit lines.

**Verify by reading the repo, not from memory.** Some git hosting integrations inject
a footer server-side even into a request that omitted one — treat that as expected
behavior, not a surprise. After every commit and after every PR create/update, re-read
the actual result and strip any attribution found, regardless of source:
- Run `git log` and read the actual commit messages
- Re-fetch and read the actual PR body text
- Remove any attribution found, regardless of source

A commit or PR is not finished until this read-back check has run — don't rely on what
you wrote, check what actually landed.

## GitHub Issues and PRs

Issue and PR templates live in `ScottKirvan/.github` (or your org's equivalent) and
apply to this repo automatically via GitHub's community health file fallback.

- Bug reports → `[BUG]` title prefix, `bug_report.md` sections
- Feature requests → `[FEATURE]` title prefix, `feature_request.md` sections
- General → `[GENERAL]` title prefix, `general_report.md` sections
- PRs → fill all checklist sections; no attribution anywhere in the body

Before creating any issue: check for duplicates first — `gh issue list --state open
--limit 100` where the `gh` CLI is available, or the equivalent GitHub search/list
tool (e.g. an MCP GitHub server's `search_issues`/`list_issues`) in hosted sessions
that don't have `gh`. Don't skip the check just because the literal command doesn't
apply in a given environment.
Create issues only when explicitly asked — don't preemptively file future work.

## Sub-Agent Workflow

When using sub-agents for implementation:

- Brief sub-agents on **what** to build, not **how** — implementation decisions belong
  to the sub-agent, which serves as an independent second opinion on the approach.
- Not every implementation choice is "how." A choice is **load-bearing** — and belongs
  in the brief as a stated constraint, not left implicit — if getting it wrong would
  foreclose a decision already made elsewhere, or if fixing it later would cascade into
  sibling components rather than staying local to the one being built. The test: would
  changing this later touch only this component, or would it touch others or
  contradict something already decided? Local and reversible → genuinely "how,"
  delegate freely. Cascading or hard to reverse → state it explicitly in the brief.
  (Architecture — how two components relate, e.g. whether one delegates to the other —
  is the case that's easiest to misclassify as "how" when it's actually load-bearing.)
- Sub-agents follow all conventions in this file except they do not create PRs.
- After a sub-agent completes, review its diff and tests before creating the PR.
  This review is a genuine code review, not a compliance check — evaluate correctness,
  requirement alignment, and test quality independently.
- Simple issues found in review may be fixed directly. Significant deviations from the
  stated requirements or complex problems go back to the sub-agent rather than being
  patched over.
- Create the PR only after review passes.
