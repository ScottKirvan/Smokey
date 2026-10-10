# ADR-0009: Anyone can look up any account; no paid tier

- Status: Accepted
- Date: 2026-10-09

## Context

Selling access to recruiters was considered as a way to monetize. The legal concerns around automated hiring tools removed the interest.

## Decision

- Anyone can use the tool on any account's public data: "public data is public data; we're munging it and running analysis and visualizations".
- Recruiters can use the tool the same way any developer can. It isn't packaged or sold to them.

## Consequences

- No accounts, billing or team features.
- With no hosted server ([ADR-0003](0003-no-database-no-hosted-server.md)), lookups happen in the viewer's own browser or terminal. See [privacy-and-legal.md](../privacy-and-legal.md) for what that does and doesn't settle.
