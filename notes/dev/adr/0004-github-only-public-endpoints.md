# ADR-0004: GitHub is the only forge; other sources through public endpoints only

- Status: Accepted
- Date: 2026-10-09

## Decision

- GitHub is the only forge supported.
- Other sources (package registries, OpenSSF Scorecard, external score sites) are read only through their public endpoints. Tighter integrations wait until there's a reason.

## Consequences

- Sources without a public endpoint (for example, a score site whose API is a paid plan) are out.
- `[Proposed — unconfirmed]` Every evidence record still names its source, which costs nothing now and keeps other forges possible later.
