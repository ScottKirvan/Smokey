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

`tests/lint-repo-matching.spec.js` is a static source-text check, not a behavioral test — it `fs.readFileSync`s `index.html` and asserts the raw `S.repos` config strings are never compared directly against a GitHub-resolved canonical name (see **Repo-rename matching** below). Recurred three times across three different functions before this guard existed; keep it in mind as the model for any other "this pattern keeps recurring" bug class.

**Startup-load race:** `init()` calls `load()` on every `page.goto('/index.html')`, firing real, unmocked fetches (repo data, traffic CSV, issue history) in the background. A test that manually mocks `window.fetch` and renders something can finish its assertions before that background `load()` settles — when it does settle, it silently overwrites the test's render with whatever the real (or aborted) network calls returned. `gotoQuiet(page)` — block `api.github.com`/`raw.githubusercontent.com` via `page.route(...).abort()`, then `page.goto()`, then `waitForFunction` for the refresh spinner (and `!issueLoading`, where relevant) to clear — closes that race before a test's own setup runs. Defined independently in each spec file that needs it (`traffic-history.spec.js`, `issue-trend.spec.js`, `issue-sync.spec.js`); `traffic-history.spec.js` was missing it until a CI run surfaced the exact symptom (a mocked "10 views" assertion seeing real live traffic-log data instead) — worth adding to any new spec file that mocks `window.fetch` and goes straight to `page.goto`.

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

localStorage keys: `rw_pat`, `rw_repos`, `rw_show_org`, `rw_feed`, `rw_notifs`, `rw_sort_by`, `rw_sort_dir`, `rw_issues_v1` (issue cache), `rw_sync_v1` (per-repo issue sync timestamps).

### Repo-rename matching

`S.repos` holds whatever raw `owner/repo` strings the user typed into Settings. If a repo gets renamed on GitHub afterward, GitHub transparently redirects most endpoints for the old name, so fetches keep working — but the old string itself never updates. `fetchRepo()` is the only place that resolves the canonical name (`repo.full_name` from the API response, stored on each `S.data` entry); everything else must match against that, never against `S.repos` directly. Getting this wrong doesn't error — it just silently drops that one repo's data with no visible symptom. It's recurred three times so far: `pollEvents()` (event feed), `loadTraffic()` (traffic chart), and `load()`'s CI-status merge (see `tests/repo-rename-drift.spec.js` for the full history and `tests/lint-repo-matching.spec.js` for the static guard against a fourth). `load()`'s CI merge in particular used to `.find()` by name; fixed to zip `S.data` and `fetchWorkflowRuns()`'s results by index instead, since both are produced by the same `S.repos.map(...)` call and `Promise.all` preserves order — no name lookup needed at all.

### Issue history sync

`loadIssueHistory()` fetches a repo's full issue history once, then only asks for issues updated since that repo's timestamp in `rw_sync_v1`. A repo's timestamp advances **only** when its fetch reaches the last page. A rate limit (403/429), any other HTTP error, or a network failure leaves it untouched, so the next load retries the repo. A rate limit also stops the run for the remaining repos instead of spending more calls. Advancing the timestamp after a partial fetch used to leave a silent, permanent gap: later `since=` queries never return the pages that were skipped. Without a PAT this was easy to hit, because a first load needs roughly 30 issue-history calls on top of `load()`'s per-repo calls, against GitHub's 60/hour unauthenticated limit. See `tests/issue-sync.spec.js`.

### Key features

- **Repo table** — sortable: name, visibility, last push, open issues, stars, latest release, CI status. Private repos show a lock icon to the left of the name (`d.private`, from the `/repos/{owner}/{repo}` response — set in `fetchRepo()`, rendered in `rowHTML()`). The `LOCK_ICON` svg is `--text-muted`, matching the version tag's brightness (not `--text-dim`, which read as too faint).
- **CI status dots** — PAT-gated; color-coded per latest workflow run. Calls `/repos/{owner}/{repo}/actions/runs?per_page=10`. Dedupes by workflow name (newest per workflow). Results are zipped onto `S.data` by index, not matched by name — see **Repo-rename matching** above. Classification:
  - `CI_RED` (`failure`, `timed_out`, `startup_failure`) — red glow
  - `CI_ICE` (`waiting`, `pending`, `action_required`) — cyan `--ice` glow (blocked/waiting for approval)
  - `CI_YELLOW` (`cancelled`, `in_progress`, `queued`) — yellow, no glow
  - Green (`success`, `neutral`, `skipped`) — green glow
- **Traffic chart** — full history, not just GitHub's 14-day live-API window. `loadTraffic()` fetches `views.csv` from the `traffic-log` branch (`raw.githubusercontent.com/ScottKirvan/Smokey/traffic-log/views.csv`) — a daily snapshot accumulated by a separate weekly GitHub Actions workflow (`log-traffic.yml`, using the `TRAFFIC_PAT` repo secret), unbounded by GitHub's 14-day API window (which itself can lag by more than a day — "yesterday" showing 0 was a real, confirmed API gap, not a bug). Filtered to the canonical `full_name`s resolved into `S.data` (not raw `S.repos` strings — see **Repo-rename matching** above), aggregated by calendar date, fed into `renderChart()`. `load()` now awaits `fetchRepo()` before calling `loadTraffic()` (previously ran in parallel) so those canonical names are available in time to filter correctly. No PAT involved — the CSV is a public file; doesn't touch the "PAT sent only to api.github.com" constraint, and the chart now works with no PAT at all. `renderChart()`'s log x-axis / sqrt y-axis scaling is unchanged from the original 14-day-only chart — both were already parameterized by `data.length`, so the same math applies to the longer, growing range. Axis labels are the oldest/newest dates in the data rather than fixed relative labels.
- **Issue trend chart** — not a standard chart type; a one-off mark invented for this repo to show two things in one glyph: where the running open-issue count is on a given day, and how much opened/closed that day. Three overlaid categories: `bug` label → Bugs, `enhancement` → Feat, anything else → Misc (PRs excluded). Each category has three chart-only color tokens: `--{cat}-core` (needle center and its glow), `--{cat}` (needle tips) and `--{cat}-line` (count line, today dot); the legend swatches use `--{cat}-core` so they match the spikes. The palette is a neon/cyberpunk one Scott picked: bugs are a pure magenta core fading to near-black rust tips on a dark purple line; feat is a pure cyan core fading to near-black teal tips on a dark teal line; misc is a dim gray throughout, so the least interesting series fades into the background. The lines are deliberately dark so the spikes pop. These are separate from `--ext`, the app-wide failure red. Light mode drops the sci-fi palette for grayscale (Scott's call: it isn't worth it on white), with the categories told apart by darkness: bugs near-black, feat mid-gray, misc pale. Every tip fades toward the white background. Log x-axis (recent days wide, old history compressed). Issues are fetched client-side by `loadIssueHistory()` and cached per repo in `rw_issues_v1`; there is no server-side job, so it follows whatever repos are in Settings. `buildIssueSeries()` tracks, per category per day, `opens`/`closes` separately plus the running `count` (opens − closes, cumulative).
  - **X-axis.** `xp()`/`dayWidth()` log-scale `ago` (days back) against `maxDays`, both offset by `X_LOG_EPS = 7` rather than a bare `+1`. `log()`'s slope is steepest at its own start, so a `+1` epsilon made "today" alone — the `log(1)→log(2)` step — eat a wildly disproportionate slice of the width (~9% of the whole chart over a ~6-year history, dwarfing every neighboring day). `+7` (a week) flattens that initial slope so today tapers in with its neighbors instead of spiking. The mapping lives in one shared `logX(ago, maxDays, W)`, normalized by subtracting `log(X_LOG_EPS)` so `ago=0` lands exactly on `W` and `ago=maxDays` on `0` — without that, shifting the epsilon put today at ~75% of the width and left the right quarter of the chart empty. `xp()`, `dayWidth()`, the milestone labels and the grid ticks all go through `logX`, so they can't drift apart. Inside `renderIssueChart()` they're called with `XW` (`W` minus ~7px) rather than `W`, so "today" sits just inside the right edge and its dot isn't half-clipped. See the `dayWidth` describe block in `tests/issue-trend.spec.js` for the regression guard (today's width vs. yesterday's, capped below 2x).
  - **Pixels vs. units.** The SVG is stretched to fit (`preserveAspectRatio="none"`): on a phone 1000 user units can be ~350px wide while the 80 units of height stay 80px, so anything sized in user units changes shape between devices (it's why the glows are vertical ovals). Things that should look identical everywhere are sized in screen pixels: strokes use `vector-effect="non-scaling-stroke"`; the needle half-width and the today inset are converted from px via `unitsPerPx = W / svg.getBoundingClientRect().width`; the today dots are HTML (see **Performance**), so they're round by construction. The px conversion is read once per render, not on window resize.
  - **Look.** In dark mode the marks use `mix-blend-mode: screen` (via the `--issue-blend` theme token), so overlapping needles, glows and lines add up to brighter light instead of covering each other; light mode sets the token to `normal`, because screen over a light background washes everything to white. `#issueGrid` (painted first) draws a half-pixel grid (`stroke-width="0.5"` + non-scaling-stroke, one device pixel on a high-DPI screen) at `--issue-grid-opacity` (0.35 dark, 0.18 light). The light value is kept below the pale misc line so the two don't merge. It covers the whole SVG like log graph paper: horizontals every 10 units from the top edge to the bottom, and full-height verticals at calendar steps (1–3 weeks, months out to a year, then every year from 4yr). The labeled milestones and today are `issue-grid-major`; the rest are `issue-grid-minor` at 55% of the grid opacity, so the labeled lines still stand out. `#issueNowDots`, an HTML layer over the SVG, holds a dot at the right-hand end of each category's line. Each dot is positioned by `left: %` (which tracks the stretched viewBox) and `top: px` (1 unit = 1px vertically). Its halo pulse (`issue-now-pulse`, disabled under `prefers-reduced-motion`) animates only `transform`/`opacity` on a pseudo-element.
  - **Marks.** `renderIssueChart()` draws, per category, a full-history 1px `<polyline class="issue-line">` connecting `(xp(day), yp(count))` across every day (not just active ones) and held flat to today, since the count holds until the next event, plus a faint, slightly wider blurred copy (`issue-line-glow`, 1.5px at 25% opacity, `#issueLineBlur`; stronger settings just made the lines look blurry; which uses `filterUnits="userSpaceOnUse"` sized to the whole chart; the default bounding-box filter region would crop the blur of a nearly flat line). Both are emitted first so they paint underneath everything else in that category's `<g>`. Then comes one thin vertical needle `<polygon>` per category-day with `opens>0 || closes>0`: a 4-point kite (top tip, right-mid, bottom tip, left-mid) widest at `y0 = yp(count)` — the same position the line sits at — tapering to a point at its top and bottom tips, filled with a 5-stop linear gradient (bounding-box trick): tip color through the outer half of each side, rising to the core color exactly at `y0` (the stop carries `class="issue-core-stop"`). The result is a tight bright band rather than a fade spanning the whole needle. A small `<circle class="issue-glow">`, filled with a per-category radial gradient (`#issueGlow-{cat}`, core color fading to transparent, defined once in the static `<defs>`), sits behind each candle's center for a soft halo. It used to be a solid circle blurred by an `feGaussianBlur` filter; one filter per glow made every repaint expensive. It's emitted just before its polygon so the polygon paints over it.
  - **Length.** `heatLen(n, maxVal, maxLen)` is *quadratic* (`(n/maxVal)² · maxLen`), not linear — `heatLen(opens, …)` extends the diamond's top tip upward from `y0`, `heatLen(closes, …)` extends its bottom tip downward — so a 10x-busier day reaches ~100x the length of a quiet one, dramatizing intensity rather than reading proportionally. `MAX_LEN = CH * 0.65 * 3` — 3x the prior cap, deliberately allowed to exceed the chart's own plot area now that `#issueChartSvg` clips (`overflow: hidden`, overriding the `.chart-wrap svg { overflow: visible }` rule the traffic chart relies on) instead of the general rule's visible bleed: a clipped diamond still reads by its taper alone, so nothing is lost by letting a genuinely busy day dominate rather than flattening it to fit.
  - **Width.** The needle's half-width at `y0` is a fixed 2.5px (`NEEDLE_HALF_PX`, converted to units), still capped by `dayWidth()` so a busy day far back in a long history can't smear across neighboring compressed days. The glow behind it is sized from the day slot instead (`max(2, min(10, dayWidth) · 0.6)` units), independent of the needle. Thin needles alone would leave a one-issue day as an invisible hairline, and the smudge is what calls those days out.
  - **Sweep animation.** `playIssueSweep()` is a one-shot left-to-right reveal (`SWEEP_MS = 6000`, constant speed: `front = XW · t`; an ease-out covered two-thirds of the width in the first few frames). An animated `#issueSweepClip` rect, applied to the `#issueSweep` group only while sweeping, uncovers the lines, needles and glows behind the front. `#issueHeads` holds a scanline at the front (a trailing `#issueScanGrad` gradient plus a 1px edge, in `--text`) and a bright dot per category riding its line; `lineYAt()` interpolates the per-category points that `renderIssueChart()` stores in `issueSweepGeom`. The today dots are hidden during the sweep and appear where the riding dots stop. It reads `performance.now()` each frame rather than rAF's timestamp, which can predate the start and make the clip width negative.
    - **When it plays.** Once per `load()` run (page load, manual refresh, settings save: every caller is user-initiated), on the first render with data inside `loadIssueHistory()`, normally the instant cache render. The background re-render after the fetch doesn't replay it. A click anywhere on the chart replays it from the left, including mid-sweep. Under `prefers-reduced-motion` it never plays and clicks do nothing; the pointer cursor only shows when motion is allowed. Calling `renderIssueChart()` directly never starts a sweep, so the geometry tests are unaffected.
    - **Performance — keep CSS animations out of the chart SVG.** The first version gave each needle its own CSS "ignite" animation (scale + brightness filter) with `fill-mode: both`. On a phone the sweep fell to a few frames a second, and because `both` holds the final frame, hundreds of finished animations stayed attached afterwards. They kept costing on every frame, so the tickers jittered long after the sweep ended. Per frame the sweep now touches only the clip width, the scanline and three dots. The `svgAnims` check in the sweep test asserts no CSS animation targets anything inside the SVG; it fails on the old version. The same reasoning put the today-dot pulse in HTML and swapped the glow blur filters for gradients. Measured with Playwright under 4x CPU throttling: the old sweep managed ~10 frames in 1.5s, the current one ~140 in 3s. Headless Chromium has no GPU, so it overstates the cost of `mix-blend-mode` relative to a real phone. Scott's phone ran blending plus the pulse smoothly before the sweep existed, so trust device reports over headless numbers for blend/compositing questions.
    - **Testing.** The sweep tests use Playwright's fake clock with `pauseAt`, then step it with `runFor`. Plain `install()` lets time keep flowing, and screenshots/evaluates are slow enough that a sweep finishes between steps.
  - Design history: a high/low "candlestick wick" (OHLC-style) was tried first — at 80px tall one issue is under a pixel, so the wick barely moved; then a connecting step-line with sqrt-scaled round-capped "swell" marks over it, dropped for reading noisy/blobby; then flat rectangles with linear length and no connecting line; then tapered diamonds with quadratic length and no line; then the line came back underneath the diamonds; then thin needles with a neon line, additive blending, a faint grid and a pulsing today dot, a pass aimed at a tighter, more modern look than the chunky diamonds. Don't read "candlestick"/"diamond"/"dart" here as standard chart semantics — they're shorthand for the shape, not an established chart type. See `tests/issue-trend.spec.js`.
- **Event feed ticker** — continuous CSS marquee strip below the traffic chart. Polls `/users/{username}/events` every 60 s using ETag conditional requests (respects `X-Poll-Interval: 60`). Shows the 10 most recent events across monitored repos (`S.feedItems` itself is also capped at 10 in `pollEvents()`, so the display cap and the storage cap now match); deduplicates PushEvents within 5-min windows. PAT-gated, opt-in via Settings toggle. CSS: doubled chip set + `translateX(0 → -50%)` keyframe for seamless loop, scroll duration `Math.max(7.5, chipCount * 3)` seconds — 2x the original `Math.max(15, chipCount * 6)` baseline. Needs `S.currentUser` (the feed URL is per-username); `resolveCurrentUser(headers)` resolves it once and is called both from `load()` and lazily from `pollEvents()` itself if still unset, so a single failed `/user` fetch self-heals on the next 60s poll instead of permanently disabling the feed for the rest of the session (see `tests/feed-startup-resilience.spec.js`) — this was a real bug: notifications has no such dependency, so it kept working while the feed silently didn't, with the exact same PAT and toggle both on.
- **Notifications ticker** — second marquee strip below the event feed, sharing its CSS mechanics (doubled chip set, same scroll keyframe). Its "ALERTS" label links out to `github.com/notifications`. Polls `GET /notifications?per_page=100` every 60 s using `Last-Modified` / `If-Modified-Since` conditional requests (per GitHub's docs — this endpoint uses `Last-Modified`, not ETag, unlike the events endpoint above). Shows every unread notification the poll returns — unlike the event feed's 5-item cap, there's no truncation here; `per_page=100` (GitHub's max for this endpoint) is the only limit, not paginated further. Unlike the event feed, this is account-wide, not filtered to `S.repos` — it's GitHub's own unread-notifications inbox (`all=false` is the API default). Only classic PATs can call this endpoint; fine-grained PATs are unsupported per GitHub's docs, and it needs the `notifications` or `repo` scope. PAT-gated, opt-in via its own Settings toggle (`S.showNotifs` / `rw_notifs`), independent of the event feed toggle. Each chip ends with a `relTimeStr(item.updatedAt)` relative timestamp, same as the event feed's chips.
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
| `--bug-core` / `--bug` / `--bug-line`    | `#ff00ff` / `#2b0f12` / `#4b1d6b` | `#24292f` / `#c9d1d9` / `#57606a` | Issue chart Bugs: dark mode magenta core, near-black rust tips, dark purple line; light mode the darkest gray |
| `--feat-core` / `--feat` / `--feat-line` | `#00ffff` / `#052b33` / `#0e4f5a` | `#8c959f` / `#e6eaef` / `#a8b1bb` | Issue chart Feat: dark mode cyan core, near-black teal tips, dark teal line; light mode mid gray |
| `--misc-core` / `--misc` / `--misc-line` | `#5a6069` / `#14181e` / `#3e4249` | `#c9d1d9` / `#f0f3f6` / `#d8dee4` | Issue chart Misc, kept subdued; light mode the palest gray |

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
