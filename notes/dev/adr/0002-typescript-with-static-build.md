# ADR-0002: TypeScript with a build step that outputs a static site

- Status: Accepted
- Date: 2026-10-09

## Context

Smokey is one vanilla-JS file with no build step. The new tool must run the same analysis in the browser, the terminal, GitHub Actions and a local API. Python was considered: stronger for data analysis, but the browser, Actions and embedding all pull towards JavaScript, so Python would mean two languages or duplicated logic.

## Decision

- TypeScript throughout.
- A build step is acceptable; the explorer is still delivered as a static site.

## Consequences

- One analysis core shared by every surface, so the same evidence gives the same result everywhere.
- Smokey's "no build step" rule applies to `main` until cutover, not to the new branch.
- Bulk offline analysis, if ever needed, can still be done separately without entering the request path.
