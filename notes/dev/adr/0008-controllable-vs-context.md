# ADR-0008: Keep what you control apart from context

- Status: Accepted
- Date: 2026-10-09

## Context

Part of the motivation is a tool that shows what I could improve. Some signals respond directly to effort (response time, release discipline, docs); others don't (downloads, stars).

## Decision

- Each metric is flagged as controllable or context.
- Improvement views lead with controllable signals. Context is shown, but never as a to-do.

## Consequences

- A new project isn't presented as failing for being new.
- Signals that are cheap to fake (an empty CHANGELOG) are weaker than signals where gaming means doing the real work (a changelog updated with every release). `[Proposed — unconfirmed]` Prefer the latter in built-in lenses.
