# Cutover runbook (outline)

Status: outline, 2026-10-09. Every step is `[Proposed — unconfirmed]`. It becomes the real runbook once the development branch is ready (requirement R-D10, design in [RFC-0003](../rfc/0003-build-release-delivery.md)).

A runbook is followed step by step on the day, with a check after each step and a way back. Fill in exact commands, branch names and URLs before using it.

## Readiness, before the day

- [ ] Every artifact has been built on the development branch, and every release job has passed a dry run there (R-D3).
- [ ] The new snapshot workflow has run alongside `log-traffic.yml` and `update-starline.yml` for at least two weekly runs, and its records match theirs for the same days.
- [ ] The migration converter has run against copies of `traffic-log` and `starlines`, and record counts and per-day totals match the source files ([RFC-0002](../rfc/0002-snapshots-card-kit-publishing.md#migration-from-smokey)).
- [ ] The cutover release's notes are staged and edited by hand (commit lists from a long-lived branch make poor notes).
- [ ] Rollback has been rehearsed: switching Pages back to serving `main` restores today's Smokey.
- [ ] The last `log-traffic.yml` run is recent, so the 14-day traffic window has slack.

## On the day

1. Announce a short freeze on merges to `main` and the development branch.
2. Merge the development branch into `main` (a merge commit keeps its history intact).
3. Run the migration converter for real, writing the new data branch. Leave `traffic-log` and `starlines` untouched.
4. Verify the converted data: counts and totals match the dry run.
5. Release from `main`: npm packages, Action tags, the explorer and docs build.
6. Switch GitHub Pages from `legacy` (branch) to `workflow`, and deploy the explorer and docs as one site (R-D6).
7. Check the live site: explorer loads, docs load at their path, the snapshot history shows, an installed PWA picks up the new version on its next load (R-D7).
8. Point Smokey's own repo at the new snapshot workflow; disable (don't delete) `log-traffic.yml` and `update-starline.yml`.
9. Lift the freeze.

## Rollback

| If | Then |
| --- | --- |
| The explorer is broken after step 6 | Switch Pages back to `legacy` from `main` at the pre-merge commit; investigate on a branch |
| Converted data is wrong | Delete the new data branch; the old branches are untouched; fix the converter and rerun step 3 |
| The new snapshot workflow fails | Re-enable `log-traffic.yml`; it can run alongside without conflict |
| A published npm package or Action tag is broken | Publish a fix forward; deprecate (npm) or move the major tag back (Actions) rather than deleting versions others may have pinned |

## After

- Keep `traffic-log` and `starlines` read-only for at least one release cycle, then archive them.
- Retire the old workflows once two new weekly runs have succeeded.
- Update the devops agent's repo inventory and Smokey's CLAUDE.md to the new workflows.
