# Product requirements

Status: draft, 2026-10-09. The project is deliberately unnamed; `<tool>` stands in wherever a name is needed.

## Summary

The next stage of Smokey: a serverless, GitHub-only tool that shows what a developer account and its repos actually do. It serves the developer's daily work ("what's on my plate today"), their long-term improvement ("what's the strategy looking like"), and anyone who wants to understand their work — recruiters and hiring managers included. It favours visuals with meaning over a single headline number: "GitRanks, but with metrics and meaning."

## Problem

- GitHub profile pages and existing leaderboards mostly measure attention: stars, followers and raw contribution counts. They say little about how someone ships, maintains and responds.
- Smokey answers "what needs me today" for a hand-picked set of repos, but not "how am I doing over time" or "how do I compare with the people and projects I'm modelling myself on".
- Some of the most telling history isn't kept by GitHub. Traffic covers 14 days. Since GitHub's [June 2026 change](https://github.blog/changelog/2026-06-30-upcoming-access-restrictions-to-public-api-endpoints-and-ui-views/), stargazer lists (and so star timing) are visible only to a repo's admins and collaborators.

## Users and jobs

| Who | Job | Where |
| --- | --- | --- |
| Me, maintaining | See what needs attention today: outside PRs and issues, CI, alerts, activity | Explorer, Today view |
| Me, improving | See how my practices and reach trend over time, and what to work on | Explorer, Long-term view, with my token and snapshots |
| Me, presenting | Put verified, meaningful evidence of my work on my profile | Card kit |
| Me, modelling | Compare my repo with a repo I want mine to be like; compare my account head to head with a peer (for example, developers with working Sponsors pages) | Explorer, Compare |
| Anyone evaluating (hiring managers, recruiters, collaborators, potential sponsors) | Understand someone's work quickly from public data and anything they've chosen to publish | Explorer on public data |
| Tools and agents | Consume the same data and analysis | Core library, local API, MCP, published snapshot files |

The subject is an **account** (a user or an org) and its repos. Signals that only make sense for a person (contributions to others' projects, reviews) or only for an org (members, cross-repo patterns) switch on by account type.

## Surfaces

- **Explorer.** A static page in the Smokey tradition: runs in the viewer's browser and calls GitHub directly. A token is optional and stays in the browser. Two time horizons (Today, Long term) plus Compare. The viewer picks the lens.
- **Card kit.** A Starlines-style Action in the developer's own repo. It renders what the owner's chosen lens says belongs on their public profile: images, badges, a Markdown fragment for the profile README, and an HTML version for a personal site. Read-only.
- **Snapshot workflow.** A scheduled Action in the developer's own repo that keeps the history GitHub forgets or hides. Its output can be published opt-in.
- **CLI and TUI.** The same analysis in the terminal, with a full interactive TUI.
- **Local headless mode.** The CLI exposes the same data and analysis over a local API and MCP, so other UIs and agents can attach.

See [architecture.md](architecture.md) for how they fit together.

## Requirements

Requirement IDs are stable references for stories, tests and ADRs. Items marked `[Proposed — unconfirmed]` are my suggestions, not decisions.

### Today (carried over from Smokey)

- **R-T1** Per-repo table: last push, latest release and date, open PRs, open issues split bug/feature/misc, CI status, private-repo indicator.
- **R-T2** Attention: outside PRs and issues awaiting a response, with bots filtered out.
- **R-T3** Activity feed and notifications ticker (token-gated, opt-in).
- **R-T4** Traffic, issue-trend and star charts, with history from snapshots.
- **R-T5** Rate-limit visibility, and graceful degradation without a token.

### Long term

- **R-L1** Trends rebuilt from timestamps GitHub keeps: commit cadence, issues opened and closed by type, maintainer response times, release history, PR review latency.
- **R-L2** Trends from snapshots for data GitHub forgets or hides: traffic, release downloads, star timing, registry downloads, external scores.
- **R-L3** Signals the developer controls (response time, release discipline, docs) are presented apart from context they can't directly move (downloads, stars).
- **R-L4** Per-dimension 0–100 values drive the visuals. Repos and orgs may have an item score; people never get a single headline number.

### Compare

- **R-C1** Overlay two accounts, or two repos, under the same lens.
- **R-C2** The user always chooses who or what to compare. No peer discovery.
- **R-C3** Repo modelling: show when the model repo adopted practices (CI, releases, templates, security policy) and how its activity grew. `[Proposed — unconfirmed]` Align both repos by project age ("month N since first commit") as well as by calendar date.
- **R-C4** Sponsors evidence where GitHub exposes it publicly (listing, tiers, public sponsors, goal progress — exact availability to be verified).

### Lenses

- **R-N1** Metrics are flat; there is no fixed classification such as engaged/engaging. A lens selects metrics, arranges them and sets how they're normalized and drawn.
- **R-N2** In the explorer the viewer picks the lens. On the card the owner picks it.
- **R-N3** A custom or third-party judgment is always labelled with its lens; nothing renders as a bare grade.

### External scores

- **R-X1** "External score" is a plugin type: a score from another site, read from its public endpoint.
- **R-X2** Where a site's formula is public, the tool can reproduce it and show which inputs move it. github-readme-stats is the reference example.
- **R-X3** External scores can be tracked over time through snapshots, for goal-setting ("improve my standing on site X").

### Card kit

- **R-K1** Generated by an Action in the owner's repo on a schedule; no server.
- **R-K2** Outputs: images (charts, badges, summary blocks), a Markdown fragment written between marker comments in the profile README, and an HTML version.
- **R-K3** Uses only data the owner has marked public.
- **R-K4** `[Proposed — unconfirmed]` Light and dark variants of every image, since GitHub READMEs render in both themes.

### Snapshots and publishing

- **R-S1** A scheduled Action in the user's own repo appends snapshots of data GitHub forgets or hides.
- **R-S2** Publishing is opt-in, per dataset, by the owner.
- **R-S3** Published data uses an open format at a discoverable location, so any tool can read it.
- **R-S4** Snapshots are signed through GitHub artifact attestations if that proves workable, so viewers can tell workflow-produced data from hand-edited data.

### Access and platform

- **R-A1** Works with no token on public data, within GitHub's unauthenticated limits. A token raises limits and unlocks private and owner-only data. The token is never sent anywhere except `api.github.com` (Smokey's existing rule).
- **R-A2** GitHub is the only forge. Other sources (registries, Scorecard, external score sites) are read only through public endpoints.
- **R-P1** The core is an embeddable library.
- **R-P2** Collectors, lenses, visuals and external scores are extensible through plugins.
- **R-P3** The terminal interface is first-class.

### Delivery and operations

How the tool is built, released, hosted and run. All `[Proposed — unconfirmed]`; the design is in [RFC-0003](rfc/0003-build-release-delivery.md).

- **R-D1** Every PR into the development branch runs typecheck, lint, unit tests, schema validation, the explorer's end-to-end tests and workflow lint; they must pass to merge.
- **R-D2** The development branch publishes nothing: no releases, tags, npm packages, live Pages deploys or announcements.
- **R-D3** Every artifact the cutover ships (npm packages, Action bundles, the explorer build) is built in CI on the development branch before cutover, and every release job can be dry-run there.
- **R-D4** Each release of a package, Action bundle or the explorer comes with an SBOM and build provenance (artifact attestations).
- **R-D5** The tool's own workflows and the Actions it ships pin third-party actions to commit SHAs.
- **R-D6** The explorer and its user docs deploy together as one GitHub Pages site.
- **R-D7** A deploy reaches returning users, including the installed PWA, on their next load.
- **R-D8** The published data format and the Actions' inputs and outputs are versioned public contracts; a breaking change bumps the major version and ships a converter or migration note.
- **R-D9** Snapshot runs that hit an expired token, a rate limit or a partial fetch fail visibly and commit nothing, and an expiring token is flagged before it expires.
- **R-D10** Cutover follows a written runbook with verification steps and a rollback path.

## Progression

Phases are an order of construction, not releases. All development happens on a separate branch; Smokey's `main` keeps running until cutover. Everything below is `[Proposed — unconfirmed]` as to order.

0. **Foundations.** Monorepo, schemas, core library, GitHub client with rate budgeting, fixture-recorded tests, CI on the development branch ([RFC-0003](rfc/0003-build-release-delivery.md)).
1. **Today parity.** Rebuild Smokey's current features on the new core in the explorer.
2. **Snapshot workflow.** New Action replacing `log-traffic.yml`, adding downloads, star timing and registry data; converter for the existing `traffic-log` CSVs and `starlines` caches.
3. **Long-term view.** Trends, dimensions, the first lenses.
4. **Compare.** Account against account, repo against repo, modelling timeline.
5. **Card kit.** Action generating images, the README fragment and HTML.
6. **Publishing.** Discovery convention, attestation signing and in-explorer verification.
7. **Terminal and local API.** CLI, TUI, local API and MCP.
8. **Platform.** Stable plugin API; external-score plugins starting with github-readme-stats.
9. **Cutover.** Run the migration, switch Pages to the new build, retire the old workflows, following the [cutover runbook](outlines/cutover-runbook.md).

## Done looks like

- I can open the explorer and see what needs my attention today, as I can in Smokey now.
- I can see 12 months of trend for my own repos, including traffic and star history kept by my snapshots.
- I can put my account next to a sponsored developer's and see where we differ, under a lens I choose.
- I can put one of my repos next to a model repo and see what its maintainer did and when.
- My profile README updates itself weekly with a card I configured.
- Someone with no token can open my account in the explorer and understand my work in a couple of minutes.

## Non-goals

- A database or hosted server.
- A paid tier, or packaging for recruiters as customers.
- Finding comparable developers or repos for the user.
- Forges other than GitHub, and private APIs of other sources.
- A single headline score for a person.
- Static analysis of source code quality.
- A product name, for now.

## Open questions

- Which Sponsors fields GitHub's GraphQL API exposes publicly, and to whom.
- Whether attestations can be verified in the browser without a server.
- Fine-grained token permissions needed for traffic. Smokey's `log-traffic.yml` uses a `TRAFFIC_PAT` secret today.
- How far comparisons stretch without a token, given the 60 requests/hour unauthenticated limit.
- The starting set of built-in lenses.
- The discovery path and file names for published data.
- Delivery questions (development branch, how the Actions are published, the docs site, attestations in private repos): listed in [RFC-0003](rfc/0003-build-release-delivery.md#open-questions).
