# ADR-0007: Lenses instead of fixed categories

- Status: Accepted
- Date: 2026-10-09

## Context

I proposed splitting metrics into "engaged" (what you put out) and "engaging" (how the world responds). The same data means different things to different people, so a fixed classification doesn't fit.

## Decision

- Metrics stay flat. A **lens** chooses which metrics to show, how to normalize them and how to arrange them.
- Both sides pick: in the explorer the viewer picks the lens; on the card the owner picks it.

## Consequences

- An evaluator and the developer can look at the same account in different ways; the developer's own framing is visible on the card, the evaluator's in the explorer.
- Lenses are a natural plugin type ([ADR-0012](0012-neovim-principles.md)).
- Lens format: see [RFC-0001](../rfc/0001-evidence-metrics-lenses.md).
