# Metrics catalog

Status: draft, 2026-10-09. Every signal the tool can collect, where it comes from, who can see it, and whether the subject controls it ([ADR-0008](adr/0008-controllable-vs-context.md)). Metric keys and costs are `[Proposed — unconfirmed]`. Rows marked *verify* need an API check before they're relied on.

**Access**
- **Public:** REST, no token.
- **Token:** any token. GitHub's GraphQL API always requires authentication, so every GraphQL signal is at least Token.
- **Owner:** needs push or admin on the repo.
- **Snapshot:** only exists as history if the owner's snapshot workflow kept it ([RFC-0002](rfc/0002-snapshots-card-kit-publishing.md)).

**Cost** per subject: Low is one or two requests; Medium is paginated or a moderate GraphQL query; High is per-item fan-out or search-limited.

## Account (user or org)

| Signal | Source | Access | Controls it? | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| Profile basics: bio, company, location, blog, account age | REST `/users/{login}` | Public | Yes | Low | Context for evaluators |
| Owned repos, languages, topics | REST `/users/{login}/repos` | Public | Yes | Medium | Defines the default repo set for rollups |
| Contributions by year: commits, PRs, issues, reviews | GraphQL `contributionsCollection` | Token | Yes | Medium | One-year window per query; private counts appear only as a total, and only if the user enables it |
| Contributions to others' projects | GraphQL `repositoriesContributedTo`, PRs by author | Token | Yes | Medium | Users only |
| External PRs merged | GraphQL PR search by author, excluding own repos | Token | Yes | Medium | Users only |
| Reviews given in others' repos | GraphQL `contributionsCollection` review contributions | Token | Yes | Medium | Users only |
| Followers, following | REST `/users/{login}` | Public | No | Low | Context only |
| Sponsors listing, tiers, goal progress | GraphQL `sponsorsListing` | Token | Yes | Low | *verify* which fields are visible to other viewers |
| Public sponsors count | GraphQL `sponsors` | Token | No | Low | *verify*; private sponsors are hidden |
| Who they sponsor | GraphQL `sponsoring` | Token | Yes | Low | *verify* visibility |
| Org members, teams | REST/GraphQL org | Public / Owner | Yes | Medium | Orgs only; hidden members need membership |
| Org defaults | The org's `.github` repo | Public | Yes | Low | Shared templates and policies |

## Repo activity and stewardship

| Signal | Source | Access | Controls it? | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| Last push, last release | REST repo, `/releases` | Public | Yes | Low | Archived repos labelled, not judged |
| Commit cadence | REST `/stats/commit_activity` | Public | Yes | Low | Stats endpoints can return 202 while computing; retry |
| Issues opened and closed by type over time | REST issues (Smokey's `loadIssueHistory`) | Public | Partly | Medium | Bug/feature/misc by label, as Smokey does now |
| Maintainer first response | GraphQL issues with comments and `authorAssociation` | Token | Yes | Medium | Median time to the first OWNER/MEMBER/COLLABORATOR comment, label or close |
| Issue resolution | GraphQL `closedByPullRequestsReferences`, state reason | Token | Yes | Medium | Closed by a linked PR versus closed silently |
| Stale backlog | REST/GraphQL open issues by age | Public | Yes | Low | Open issues with no maintainer touch in 90 days |
| PR review latency | GraphQL PRs with reviews | Token | Yes | Medium | Median time to first review on outside PRs |
| Outside PR acceptance | GraphQL PRs by `authorAssociation` | Token | Yes | Medium | Merge rate for non-members |
| Outside PRs and issues awaiting response | REST issues and PRs | Public | Yes | Medium | Smokey's attention badges; bots filtered |
| Bus factor | REST `/stats/contributors` | Public | Partly | Low | Top author's share over 12 months |
| Discussions answered | GraphQL discussions `isAnswered` | Token | Yes | Medium | Only when Discussions is on |
| Commit message quality | REST `/commits` | Public | Yes | Medium | Conventional-commit share, low-signal messages ("wip", "fix") |

## Repo practices

| Signal | Source | Access | Controls it? | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| Community files | REST `/community/profile` | Public | Yes | Low | README, LICENSE, CONTRIBUTING, code of conduct, issue and PR templates in one call |
| Security policy | GraphQL `isSecurityPolicyEnabled` | Token | Yes | Low | Includes org-level policy |
| Changelog kept current | Tree + last change versus latest release | Public | Yes | Medium | Rewards a maintained file over an empty one |
| CI present | Tree `.github/workflows/` | Public | Yes | Low | |
| CI health | REST `/actions/runs` | Public | Yes | Medium | Smokey's CI dots, as a success rate over recent runs |
| Actions pinned to SHAs | Workflow YAML | Public | Yes | Medium | Also flags broad `permissions:` |
| Dependency automation | `dependabot.yml`, Renovate config | Public | Yes | Low | |
| Release hygiene | REST `/releases`, `/tags` | Public | Yes | Medium | SemVer tags, non-empty notes |
| Artifact integrity | Release asset names; attestations API | Public | Yes | Medium | Checksums, signatures, provenance; attestations API *verify* |
| Signed commits | Commit `verification.verified` | Public | Yes | Medium | Share of recent commits |
| OpenSSF Scorecard | `api.securityscorecards.dev` | Public | Yes | Low | 404 for repos outside its scan set; then unknown |
| Practice adoption dates | GraphQL history filtered by path | Token | Yes | High | For repo modelling ([RFC-0001](rfc/0001-evidence-metrics-lenses.md)) |

## Distribution and attention

| Signal | Source | Access | Controls it? | Cost | Notes |
| --- | --- | --- | --- | --- | --- |
| Release asset downloads | REST `/releases` `download_count` | Public | No | Medium | Running totals; velocity needs Snapshot |
| Stars, forks counts | REST repo | Public | No | Low | Context only |
| Star timeline | REST stargazers with `starred_at` | Owner / Snapshot | No | Medium | Admin/collaborator-only since GitHub's June 2026 change |
| Watchers count | REST repo `subscribers_count` | Public | No | Low | *verify* after the June 2026 change; `watchers_count` is actually stars |
| Traffic: views, clones, referrers, paths | REST `/traffic/*` | Owner / Snapshot | No | Low | 14-day window |
| npm downloads | `api.npmjs.org/downloads` | Public | No | Low | Package from `package.json` |
| PyPI downloads | pypistats.org API | Public | No | Low | |
| crates.io downloads | crates.io API | Public | No | Low | |
| Docker Hub pulls | Docker Hub v2 repository API | Public | No | Low | Image name matched heuristically |
| Homebrew installs | formulae.brew.sh analytics | Public | No | Low | homebrew-core formulas only |
| Dependents | deps.dev or libraries.io | Public | No | Low | *verify* coverage and terms; GitHub's "Used by" has no API |
| References in others' CI | REST code search, `path:.github/workflows` | Token | No | High | Search is heavily rate-limited; deep fetch only |

## External scores

| Score | Source | Access | Reproducible? | Notes |
| --- | --- | --- | --- | --- |
| github-readme-stats rank | Its open-source rank function over GitHub data | Token | Yes | Reference plugin ([ADR-0014](adr/0014-external-scores-as-plugins.md)) |
| OpenSSF Scorecard | Public API | Public | Partly | Its checks are documented |
| Commitgraph | Public REST API | Public | *verify* | Developer leaderboards with published methodology |
| GitRanks | Website | — | No | No public endpoint known; out unless one appears |
| oosmetrics | API on a paid plan | — | Methodology published | Out under the public-endpoints rule ([ADR-0004](adr/0004-github-only-public-endpoints.md)) |
