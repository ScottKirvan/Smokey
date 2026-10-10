# ADR-0010: History comes from a snapshot workflow in the owner's own repo

- Status: Accepted
- Date: 2026-10-09

## Context

GitHub keeps traffic for 14 days, and since June 2026 restricts stargazer lists (so star timing) to a repo's admins and collaborators. Smokey already solves this for itself with `log-traffic.yml` and the Starlines action, writing to the `traffic-log` and `starlines` branches.

## Decision

- Users who opt in run a scheduled workflow in their own repo that caches the data they want.
- They own the data. Making it public is their choice.
- This workflow, together with the local headless mode, fills the "work as a server" principle ([ADR-0012](0012-neovim-principles.md)).

## Consequences

- No central store is needed for history.
- Traffic collection needs a token beyond the workflow's built-in one (Smokey uses a `TRAFFIC_PAT` secret).
- Design: [RFC-0002](../rfc/0002-snapshots-card-kit-publishing.md).
