# RFC-0002: Snapshots, card kit and publishing

- Status: Draft, 2026-10-09
- Covers: the snapshot workflow, published data, the card kit, and migration from Smokey's branches

Everything in this RFC is `[Proposed — unconfirmed]` except where it cites an ADR.

## What Smokey does today

| Workflow | Writes | Format |
| --- | --- | --- |
| `log-traffic.yml` (weekly, `TRAFFIC_PAT` secret) | `traffic-log` branch | `views.csv` (repo, date, views, unique_visitors), `referrers.csv` and `popular_paths.csv` (per poll date) |
| `update-starline.yml` (weekly, `qoomon/starlines`) | `starlines` branch | `{owner}/{repo}/starline-cache.json`: every star's timestamp in epoch ms, plus `starline.svg` |

The repo list is hard-coded in `log-traffic.yml`. Clones aren't collected.

## Snapshot workflow

A reusable Action the user adds to a repo they own ([ADR-0010](../adr/0010-snapshots-in-owners-repo.md)).

**Configuration** lives in the repo as `.github/<tool>.yml`:

```yaml
subjects:
  - account: ScottKirvan        # all owned, non-fork repos
  - repo: ScottKirvan/Smokey    # or explicit repos
datasets:
  traffic: { publish: false }
  release-downloads: { publish: true }
  stars-timeline: { publish: true }
  registry-downloads: { publish: true }
  external-scores: { publish: true, sources: [github-readme-stats] }
schedule: weekly
```

**Datasets**

| Dataset | Source | Why it needs snapshots |
| --- | --- | --- |
| `traffic` | Views, clones, referrers, popular paths | GitHub keeps 14 days; owner-only |
| `release-downloads` | Release asset `download_count` | Only running totals; velocity needs history |
| `stars-timeline` | Stargazers with `starred_at` | Admin/collaborator-only since June 2026 |
| `counts` | Stars, watchers, forks, open issues | Running totals |
| `registry-downloads` | npm, PyPI, crates.io, Docker Hub, Homebrew public endpoints | Some only expose recent windows |
| `external-scores` | External-score plugins | Sites rarely expose their own history |

**Cadence.** Weekly by default: safe within the 14-day traffic window, as Smokey's logger already shows. Daily is an option for people who want finer download velocity.

**Writes are idempotent.** Each record is keyed by `(subject, metric, period)`; a rerun replaces overlapping records rather than duplicating them. A run that fails partway commits nothing, so no cursor ever advances past a gap (Smokey's issue-sync lesson).

**Token.** Traffic and star timelines need more than the workflow's built-in token: a fine-grained token stored as a secret, with read access to the subject repos. The exact permission set needs confirming against GitHub's docs.

## Storage layout

An orphan data branch, as Smokey uses today:

```
<tool>-data/                         # branch
  index.json                         # publication manifest
  datasets/
    traffic/ScottKirvan/Smokey/2026-10.jsonl
    stars-timeline/ScottKirvan/Smokey/2026-10.jsonl
    ...
```

- One JSON Lines file per dataset, subject and month. Each line is an [evidence record](../schemas/evidence-record.schema.json).
- Monthly files keep commits small and readers can fetch only the months they need.
- `index.json` follows [publication-manifest.schema.json](../schemas/publication-manifest.schema.json): format version, the datasets present, their subjects and months, and attestation references.

## Publishing

Owners opt in per dataset ([ADR-0011](../adr/0011-open-published-data.md)).

- **Visibility follows the repo.** A branch in a public repo is public. Datasets marked `publish: false` go to a private repo named in config, or aren't committed at all.
- **Discovery.** The explorer looks for a user's manifest at `https://raw.githubusercontent.com/<login>/<login>/<tool>-data/index.json` (the profile repo), and an org's at `<org>/.github`. A missing manifest means "not opted in", not an error.
- **The token never goes to `raw.githubusercontent.com`**, same rule as Smokey. Private datasets are read through `api.github.com/repos/.../contents` with `Accept: application/vnd.github.raw+json`, as Smokey's star chart already does.

## Attestations

Goal: the explorer can show "produced by the snapshot workflow at commit X" instead of "self-reported".

- The workflow signs each file it writes with GitHub's artifact attestations (`actions/attest-build-provenance` or its successor).
- `index.json` lists each file's digest and attestation reference.
- **Open:** verifying a Sigstore bundle in the browser with no server. If that isn't workable, the CLI verifies and the explorer shows digests plus a "verify with the CLI" note.

## Card kit

A second Action, or a mode of the same one ([ADR-0016](../adr/0016-card-kit.md)).

- **Input:** the owner's chosen lens and public datasets only, plus live public API data.
- **Outputs:**
  - SVG panels and badges, each in light and dark variants, referenced with `<picture>` and `prefers-color-scheme` so they match the reader's GitHub theme;
  - a Markdown fragment written into the profile README between `<!-- <tool>:start -->` and `<!-- <tool>:end -->`, replacing only that block;
  - an HTML version for a personal site.
- **Commit target:** the profile repo; images on the data branch so README history stays clean.
- **Labelling:** every panel shows the lens `id@version` ([ADR-0013](../adr/0013-labelled-judgments.md)).

## Migration from Smokey

At cutover ([ADR-0001](../adr/0001-next-stage-of-smokey.md)):

| From | To |
| --- | --- |
| `traffic-log/views.csv` | `traffic` records, metrics `github.repo.traffic.views` and `.uniques`, per day |
| `traffic-log/referrers.csv` | `traffic` records, metric `github.repo.traffic.referrer`, per poll date |
| `traffic-log/popular_paths.csv` | `traffic` records, metric `github.repo.traffic.path`, per poll date |
| `starlines/{owner}/{repo}/starline-cache.json` | `stars-timeline` records, one per star |

- A one-off converter writes the new branch; old branches stay untouched as a fallback.
- Repos are resolved to `nodeId` during conversion, so renamed repos (Smokey has a stale `RepoWatch` folder) land on the right subject.
- Verification: record counts and per-day totals match the source files before the old workflows are retired.

## Failure modes

| Failure | Effect | Handling |
| --- | --- | --- |
| Missed run longer than 14 days | Gap in traffic history | Shown as a gap, never interpolated |
| Expired or revoked token | Run fails | Fails loudly in the Actions log; nothing committed |
| Branch growth | Slow clones | Monthly files; optional yearly compaction |
| Hand-edited data | Untrustworthy history | Attestation status shown per file |

## Open questions

- One Action with modes, or separate snapshot and card Actions.
- Exact token permissions for traffic and stargazer timelines.
- Browser-side attestation verification.
- The `<tool>-data` branch name and discovery paths, once the project has a name.
