# ADR-0003: No database and no hosted server

- Status: Accepted
- Date: 2026-10-09

## Context

An early draft assumed a hosted service with history, caching and accounts. A database is out of scope.

## Decision

- No database and no server run by the project.
- Work happens in the viewer's browser, the user's terminal, or the account owner's GitHub Actions.
- Local caches (browser storage, CLI disk cache) are allowed; they're the viewer's own copies, not a shared store.

## Consequences

- History that GitHub doesn't keep must come from the owner's own snapshot workflow ([ADR-0010](0010-snapshots-in-owners-repo.md)).
- Most history can be rebuilt from timestamps GitHub keeps (commits, issues, releases, reviews). Running totals and short windows (downloads, traffic) can't.
- The project processes no one's data centrally, which keeps the privacy picture simple ([privacy-and-legal.md](../privacy-and-legal.md)).
- Anything that needs shared state (accounts, saved comparisons for teams) is out.
