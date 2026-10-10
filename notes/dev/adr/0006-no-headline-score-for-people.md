# ADR-0006: No single headline score for a person

- Status: Accepted
- Date: 2026-10-09

## Context

A single number is "a bit meaningless". The goal is visuals that show at a glance how engaged and engaging someone is: "GitRanks, but with metrics and meaning". Separately, single scores of people used in hiring attract regulation and are hard to defend.

## Decision

- People never get one overall number.
- Per-dimension values on a 0–100 scale drive the visuals.
- Repos and orgs may have an item score (0–100), shown as secondary to the visuals.

## Consequences

- Comparisons are read as two shapes overlaid, not as one number beating another.
- The design leans on visualization quality; that's where the product's value is.
