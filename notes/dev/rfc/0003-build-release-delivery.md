# RFC-0003: Build, release and delivery

- Status: Draft, 2026-10-09
- Covers: CI for the development branch, releasing packages and Actions, hosting the explorer, supply chain, running the snapshot workflow, and Smokey's own instance through cutover

Everything in this RFC is `[Proposed — unconfirmed]` except where it cites an ADR or states something checked on 2026-10-09. Requirements it serves: R-D1 to R-D10 in [requirements.md](../requirements.md#delivery-and-operations).

## What Smokey does today

| Workflow | Trigger | Job |
| --- | --- | --- |
| `test.yml` | Push and PR to `main` | Playwright suite against `index.html` |
| `release.yml` | Push to `main` | release-please (one package), staged or AI-written notes, Discord post |
| `docs.yml` | Push to `main` under `docs/**` | VitePress build, deployed with Actions to GitHub Pages |
| `log-traffic.yml` | Weekly | Traffic snapshot to the `traffic-log` branch (`TRAFFIC_PAT` secret) |
| `update-starline.yml` | Weekly | `qoomon/starlines` to the `starlines` branch |

GitHub Pages serves the app straight from `main`'s root (`build_type: legacy`), which runs a Jekyll build on every push.

Findings to carry forward (checked 2026-10-09):

- **The docs site isn't live.** `docs.yml` reports success, but a repo has one Pages site, and the next legacy build from `main` replaces it with the app. `/Smokey/guide/` returns GitHub's 404 page.
- **Jekyll adds a failure mode for nothing.** On 2026-10-03 its `jekyll-github-metadata` step timed out calling GitHub's API, and the site stayed on the previous version until the deploy was re-run.
- **Deploys only appear on the second load.** The service worker serves its cached copy first (cache name fixed at `rw-1`) and refreshes in the background.
- **Shared workflows are referenced at `@main`.** A change to `ScottKirvan/.github` changes every repo's release behaviour at once.

## Development branch

Development happens on a long-lived branch, `next` for example, while Smokey on `main` keeps running ([ADR-0001](../adr/0001-next-stage-of-smokey.md)).

- **CI on every PR into `next` and every push to it:** install, typecheck, lint, unit tests (Vitest with recorded fixtures), JSON Schema validation of `schemas/examples/`, Playwright for the explorer, and actionlint for workflows. A branch ruleset on `next` makes these required checks (R-D1).
- **Nothing is published from `next`** (R-D2). release-please, npm publishing, Pages deploys and Discord posts run only on `main`. `next` builds every artifact and uploads them as workflow artifacts, and every release job has a dry-run mode that can be dispatched on `next` (R-D3).
- **Work on `next` goes through PRs.** Smokey's CLAUDE.md currently allows routine commits straight to `main`; `next` needs PRs so CI gates it. Scott decides.
- **The schema checks can start now.** `notes/dev/schemas/` already has examples that validate, and a CI step keeps them valid as the design changes.

Lessons from the QuKi-Notes rewrite, which merged a long-lived branch and released it on 2026-10-03:

- Packaging that had never run in CI failed at the first release (the Windows installer script and both `.deb` builds). Every artifact must be built on `next` before cutover, not just tested.
- The release-notes prompt for 203 commits overflowed a command-line limit (since fixed in `ScottKirvan/.github`). The cutover release's notes should be staged and edited by hand, since the commit list says little about what changed for users.
- A "wait for everything, then announce" step held a broken release back from Discord. Keep that rule.

## Build

- pnpm workspaces (package layout in [architecture.md](../architecture.md)) with the pnpm store cached in CI.
- One Node version, declared once (`packageManager` and `engines` in the root `package.json`), used by CI, the CLI's supported range, and the Actions runtime (`runs.using: node24` or whatever is current at release).
- Build all packages on every run until that's too slow. Building only changed packages can come later.
- **API drift check:** recorded fixtures go stale when GitHub changes a response. A weekly workflow runs the collectors against live GitHub with a read-only token, compares response shapes with the fixtures, and opens an issue on a difference.

## Releasing

| Artifact | Published to | Versioning |
| --- | --- | --- |
| `schema`, `core`, collectors, `lenses`, `render` | npm | semver per package |
| `cli` (CLI, TUI, local API, MCP) | npm; run with `npx` or a global install | semver |
| `action-snapshot`, `action-card` | GitHub, used as `uses: <owner>/<repo>[/path]@v1` | semver tags plus a moving major tag (`v1`) |
| Explorer | GitHub Pages | Deployed from the release commit |
| Published data format | JSON Schemas in the repo, version in each manifest | Format major version ([ADR-0011](../adr/0011-open-published-data.md): a public contract) |

- **release-please in manifest mode** with the `node-workspace` plugin: a version, changelog and tag per package (`cli-v0.3.0`). The shared release pipeline in `ScottKirvan/.github` (staged notes, AI notes, Discord) assumes one tag per release. It needs to learn about components, or run only for the components worth announcing (explorer and CLI).
- **npm:** publish from a GitHub-hosted runner with provenance (`id-token: write`), preferably through npm's trusted publishing (OIDC, no long-lived `NPM_TOKEN`). Verify current npm support when this phase starts. The npm account needs 2FA. Package names wait for a project name ([ADR-0017](../adr/0017-unnamed-for-now.md)); reserve the scope once there is one.
- **JavaScript Actions run what's committed,** because a user's runner doesn't install dependencies. The release job bundles each Action into one file (esbuild or ncc) and commits the bundle only to the release tag, not to `main`. CI rebuilds the bundle and fails if it differs from what's tagged.
- **The GitHub Marketplace lists one action per repo,** from an `action.yml` at the root of a public repo. Action metadata files in subdirectories work with `uses:` but aren't listed (checked 2026-10-09). Options:
  - (a) Keep the Actions in the monorepo and reference them by path (`<owner>/<repo>/action-snapshot@v1`). One release flow, no Marketplace listing.
  - (b) The monorepo's release job pushes each built Action to its own small public repo. Marketplace listings, at the cost of extra repos and a token to push across them.
  - (c) One Action with modes ([RFC-0002](0002-snapshots-card-kit-publishing.md) leaves this open) and its own repo: one listing.

  Suggest (a) until the project has a name, then revisit.
- **Data format compatibility:** readers support the current and previous format major versions. A breaking change ships a converter for existing data branches.

## Hosting the explorer

- **One Pages site holds the explorer and the docs** (R-D6). At cutover, one workflow builds both into a single Pages artifact: the explorer at `/Smokey/` and the docs at `/Smokey/docs/`. The Pages source switches from `legacy` (branch) to `workflow`. That also removes Jekyll.
- **The docs conflict exists today.** Until cutover, either fold the docs into the app's Pages build on `main`, or stop `docs.yml` and keep the docs in the repo only. Scott decides.
- **Deploys reach returning users on their next load** (R-D7). Use hashed asset file names and a service-worker cache name derived from the build (or a generated precache manifest), instead of Smokey's fixed `rw-1`.
- **Content Security Policy:** GitHub Pages can't set response headers, so the CSP from the [threat model](../threat-model.md) goes in a `<meta http-equiv>` tag. That form doesn't support `frame-ancestors`, so framing protection is limited to what the browser does by default.
- **Custom domain:** the site stays under `www.scottkirvan.com/Smokey/`, served through the user site's CNAME. A rename at naming time ([ADR-0017](../adr/0017-unnamed-for-now.md)) needs a redirect plan, because Pages can't send redirects; a static page with a `<meta refresh>` at the old path is the usual workaround.

## Supply chain

Expands [outlines/sbom.md](../outlines/sbom.md).

- Pin every third-party action to a commit SHA, in the tool's own workflows and in the Actions it ships (R-D5). Dependabot covers the `github-actions` and `npm` ecosystems.
- Reference the shared workflows from `ScottKirvan/.github` by tag or SHA in this repo's release workflows, so a change there doesn't alter this project's releases unannounced.
- Generate an SBOM for each release (CycloneDX or SPDX, still to decide) and attest the npm tarballs, Action bundles and explorer build (R-D4). Required workflow permissions: `id-token: write`, `attestations: write`, `contents: read`. Verification is `gh attestation verify <artifact> -R <owner>/<repo>` (both checked 2026-10-09). That matches RFC-0002's fallback, in which the CLI verifies and the explorer shows digests.
- **To verify before relying on attestations for snapshot data:** which plans can attest in private repos. My understanding is that public repos can on every plan and private or internal repos need GitHub Enterprise Cloud. If so, the private datasets in RFC-0002 (`publish: false`, kept in a private repo) can't be signed on a personal plan.

## Running the snapshot workflow

Applies to users' repos and to Smokey's own instance.

- **Token:** the traffic endpoints work "for repositories that you have write access to" (GitHub REST docs, checked 2026-10-09). The fine-grained permission name still needs confirming; Smokey uses a classic `TRAFFIC_PAT` today. Stargazer timestamps need admin or collaborator access since June 2026 ([requirements.md](../requirements.md)).
- **Token expiry** (R-D9): fine-grained tokens expire. An expired token already fails the run loudly ([RFC-0002](0002-snapshots-card-kit-publishing.md#failure-modes)). Also warn before it happens: GitHub reports a token's expiry in the `github-authentication-token-expiration` response header, so the workflow can open an issue two weeks out. Check the header against current docs.
- **One run at a time** per repo through a `concurrency` group. Runs are idempotent, so a re-run is safe.
- **Data branch protection:** a ruleset blocks force-pushes and deletion of the data branch. Only the workflow writes to it, and no CI workflow triggers on it.
- **Schedules can stop.** GitHub disables scheduled workflows in public repos after 60 days without repository activity, and scheduled runs can be delayed or skipped under load. A weekly cadence against a 14-day traffic window leaves room for one missed run. To verify: whether the workflow's own commits to the data branch count as activity. If they don't, a quiet profile repo silently stops collecting, so the docs must say so and the explorer should flag a manifest whose latest snapshot is stale.

## Smokey's own instance and cutover

- The new snapshot workflow runs alongside `log-traffic.yml` and `update-starline.yml` on `main` for at least two weekly runs. Their outputs are compared before the old workflows are retired ([RFC-0002](0002-snapshots-card-kit-publishing.md#migration-from-smokey)).
- Cutover follows [outlines/cutover-runbook.md](../outlines/cutover-runbook.md) (R-D10).

## Open questions

- The development branch's name, and whether work there goes through PRs.
- Actions in the monorepo, in their own repos, or one Action with modes.
- How the shared release pipeline handles several components.
- The docs-site conflict on `main` before cutover.
- Attestations in private repos on a personal plan.
- Whether the snapshot workflow's own commits keep its schedule alive.
- The fine-grained permission names for traffic and stargazer timestamps.
