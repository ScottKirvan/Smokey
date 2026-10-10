# Next stage: design docs

Design docs for Smokey's next stage: a serverless, GitHub-only tool for understanding developer accounts and their repos, for day-to-day work, long-term improvement and comparison. The project is deliberately unnamed for now; `<tool>` is the placeholder.

Started 2026-10-09. Development will happen on a separate branch; Smokey on `main` keeps running until cutover ([ADR-0001](adr/0001-next-stage-of-smokey.md)).

## Reading order

1. [requirements.md](requirements.md): what it is, who it's for, requirements, progression, non-goals.
2. [adr/](adr/): the decisions made so far, one per file.
3. [architecture.md](architecture.md): principles, system context and container diagrams, proposed packages and stack.
4. [rfc/0001-evidence-metrics-lenses.md](rfc/0001-evidence-metrics-lenses.md): how data is recorded, derived, judged and shown.
5. [rfc/0002-snapshots-card-kit-publishing.md](rfc/0002-snapshots-card-kit-publishing.md): the snapshot workflow, published data, the card kit, and migration from Smokey's branches.
6. [metrics-catalog.md](metrics-catalog.md): every signal, its source, access and cost.
7. [schemas/](schemas/): draft JSON Schemas with validated examples.
8. [privacy-and-legal.md](privacy-and-legal.md) and [threat-model.md](threat-model.md).
9. [outlines/](outlines/): starting points for user stories, the local API, design tokens and the SBOM.

## Decided versus proposed

Following this repo's convention, anything that's a suggestion rather than a decision is marked `[Proposed — unconfirmed]`. ADRs with status **Accepted** record decisions; RFCs, schemas and outlines are proposals throughout unless they cite an ADR.

## Decisions

| ADR | Decision |
| --- | --- |
| [0001](adr/0001-next-stage-of-smokey.md) | Smokey's next stage, built on a branch; clean break with one-time migration |
| [0002](adr/0002-typescript-with-static-build.md) | TypeScript with a build step that outputs a static site |
| [0003](adr/0003-no-database-no-hosted-server.md) | No database, no hosted server |
| [0004](adr/0004-github-only-public-endpoints.md) | GitHub only; other sources through public endpoints only |
| [0005](adr/0005-accounts-as-subject.md) | The subject is an account (user or org) and its repos |
| [0006](adr/0006-no-headline-score-for-people.md) | No single headline score for a person |
| [0007](adr/0007-lenses-not-categories.md) | Lenses instead of fixed categories; viewer and owner each pick |
| [0008](adr/0008-controllable-vs-context.md) | What you control is kept apart from context |
| [0009](adr/0009-public-lookup-no-paid-tier.md) | Anyone can look up any account; no paid tier |
| [0010](adr/0010-snapshots-in-owners-repo.md) | History from a snapshot workflow in the owner's repo |
| [0011](adr/0011-open-published-data.md) | Opt-in publishing in an open format, signed where workable |
| [0012](adr/0012-neovim-principles.md) | Neovim-style principles: component, platform, server, terminal |
| [0013](adr/0013-labelled-judgments.md) | Custom judgments are always labelled |
| [0014](adr/0014-external-scores-as-plugins.md) | External scores are a plugin type |
| [0015](adr/0015-user-chooses-comparisons.md) | The user chooses comparisons; no peer discovery |
| [0016](adr/0016-card-kit.md) | The card is a profile kit generated in the owner's repo |
| [0017](adr/0017-unnamed-for-now.md) | The project stays unnamed for now |
