# Threat model

Status: draft, 2026-10-09. Mitigations are `[Proposed — unconfirmed]` unless they're existing Smokey rules or cite an ADR.

## What's worth protecting

- **Tokens:** the viewer's GitHub token in the browser or CLI; the owner's snapshot-workflow secret.
- **Owner-only data:** traffic, private repos, star timelines.
- **Trust in published data:** that snapshots weren't hand-edited.
- **The owner's repos:** the card kit and snapshot workflow have write access.

## Threats

| Threat | Impact | Mitigation |
| --- | --- | --- |
| Token sent to the wrong origin | Account compromise | Existing Smokey rule: the token is stored only in the browser and sent only to `api.github.com`. Private files are read through the contents API, never `raw.githubusercontent.com`. Add a static test guarding it, like Smokey's repo-matching lint. |
| Script injection in the explorer | Token theft | Strict Content Security Policy; no third-party scripts at runtime; all text from GitHub (issue titles, bios, referrers) rendered as text, never HTML. |
| Malicious plugin | Token theft, data exfiltration | Plugins run with full access in-process, so the explorer loads only bundled plugins; third-party plugins are a CLI opt-in with a clear warning. |
| Over-permissioned workflow token | Damage to the owner's repos if leaked | Fine-grained token, read-only on subject repos; the workflow's own `GITHUB_TOKEN` with `contents: write` only for the data branch. |
| Compromised Action dependency | Malicious code in the owner's workflow | Pin third-party actions to commit SHAs; publish an SBOM and provenance for the tool's own Actions ([outline](outlines/sbom.md)). |
| Hand-edited snapshots | Misleading evidence | Artifact attestations on published files; the explorer shows verification status ([ADR-0011](adr/0011-open-published-data.md)). |
| Gaming the metrics | Misleading evidence | Prefer signals where gaming means doing the real work ([ADR-0008](adr/0008-controllable-vs-context.md)); show provenance and coverage on every view. |
| Private data leaking into the card | Exposure of owner-only data | The card kit reads only datasets marked public; a dry-run preview before the first publish. |
| Prompt injection through MCP | An agent acting on instructions hidden in issue text, bios or commit messages | The local API returns GitHub text as data fields, never as instructions; MCP tools are read-only. |
| Rate-limit exhaustion | Broken views; locked-out token | Planner budgets every collector; stop on 403/429 without advancing cursors (Smokey's issue-sync rule). |
| Stale or renamed subjects | Silently missing data | Key subjects by GitHub `nodeId`; resolve canonical names from the API (Smokey's repo-rename rule). |
| Workflow injection in the tool's own repo | Secrets or write access stolen through a crafted PR title, branch name or issue | Pass untrusted text to `run:` steps through `env:`, never `${{ }}` inside the script; no `pull_request_target` workflow checks out PR code ([RFC-0003](rfc/0003-build-release-delivery.md)). |
| Shared workflow changed underneath | Releases change behaviour without review | Reference `ScottKirvan/.github` workflows by tag or SHA in this repo's release workflows ([RFC-0003](rfc/0003-build-release-delivery.md#supply-chain)). |
| Published npm package or Action bundle tampered with | Malicious code in users' terminals or Actions | Publish only from CI with provenance; npm trusted publishing instead of a long-lived token; 2FA on the npm account; CI rebuilds each Action bundle and fails if it differs from the tagged one. |

## Out of scope

- Attacks on GitHub itself or its API.
- A compromised viewer device.
