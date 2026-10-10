# ADR-0011: Opt-in publishing in an open, discoverable format, signed where workable

- Status: Accepted
- Date: 2026-10-09

## Context

The snapshot data could be useful to others; who wants it becomes clearer once a tool like this exists. Without a server, an "API endpoint" is a published file at a predictable URL. Self-published data can be edited by its owner, so evaluators need to know what's genuine.

## Decision

- Owners can opt in to publishing their snapshot data as static files in an open format at a discoverable location.
- Published files are signed with GitHub artifact attestations if that proves workable, so the explorer can show "produced by the snapshot workflow" rather than "self-reported".

## Consequences

- Any tool can read the data, not just this one; the format is a public contract and must be versioned.
- The discovery convention and file layout are open design questions: [RFC-0002](../rfc/0002-snapshots-card-kit-publishing.md).
