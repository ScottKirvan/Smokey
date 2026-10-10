# ADR-0001: Build the tool as Smokey's next stage

- Status: Accepted
- Date: 2026-10-09

## Context

Smokey already has much of the needed shape: a static page that calls GitHub from the browser, an optional token kept in the browser, and snapshot branches (`traffic-log`, `starlines`) that keep history GitHub drops. The new tool adds a long-term view, lenses, comparison and a card kit.

## Decision

- The tool is the next stage of Smokey, not a separate project.
- Smokey's day-to-day features (repo table, attention badges, feed, notifications, CI status, charts) stay. The tool covers two time horizons: "what's on my plate today" and "what's the longer-term strategy looking like".
- Development happens on a separate branch until it's ready to deploy, so Smokey on `main` keeps working.
- It's a clean break: no compatibility with Smokey's `localStorage` settings or snapshot formats is required. A one-time migration converts the existing snapshot history at cutover.

## Consequences

- Smokey's `log-traffic.yml` keeps collecting on `main` throughout development, so no history is lost; the migration converts all of it.
- Smokey's lessons (canonical repo names, sync cursors, token handling) carry over as constraints.
