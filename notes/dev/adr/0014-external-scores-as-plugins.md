# ADR-0014: External scores are a plugin type

- Status: Accepted
- Date: 2026-10-09

## Context

Existing sites score developers and repos (GitRanks, github-readme-stats, oosmetrics, Commitgraph, OpenSSF Scorecard and others). A goal can be "improve my standing on site X". Most of these sites weight attention metrics heavily.

## Decision

- "External score" is a plugin type, read from a site's public endpoint.
- Where a site's formula is public, a plugin can reproduce it and show which inputs move it. github-readme-stats is the reference example: its rank function is open source.
- External scores can be tracked over time through snapshots.
- No specific sites are chosen now beyond the reference example.

## Consequences

- Sites with secret formulas can only be tracked, not explained.
- Sites with no public endpoint are out ([ADR-0004](0004-github-only-public-endpoints.md)).
