# ADR-0013: Custom judgments are always labelled

- Status: Accepted
- Date: 2026-10-09

## Context

Unlimited extensibility conflicts with shared meaning: if anyone can redefine what "good" means, a bare result means nothing outside the place it was defined.

## Decision

- Collecting evidence is open without limits.
- Judging it is extensible too, but every result names the lens that produced it. Nothing renders as a bare grade.

## Consequences

- Built-in lenses carry identifiers and versions like any plugin lens.
- Cards and exports always show the lens name next to any score.
