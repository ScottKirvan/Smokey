# Schemas

Draft JSON Schemas (2020-12) for the tool's public contracts. All three are `[Proposed — unconfirmed]`; they make the RFCs concrete enough to argue about.

| Schema | What it describes | Defined in |
| --- | --- | --- |
| [evidence-record.schema.json](evidence-record.schema.json) | One observed fact about one subject at one time | [RFC-0001](../rfc/0001-evidence-metrics-lenses.md) |
| [lens.schema.json](lens.schema.json) | A lens: dimensions, normalizers, panels, optional item score | [RFC-0001](../rfc/0001-evidence-metrics-lenses.md) |
| [publication-manifest.schema.json](publication-manifest.schema.json) | `index.json` on an owner's data branch | [RFC-0002](../rfc/0002-snapshots-card-kit-publishing.md) |

`examples/` holds one valid instance of each. The lens example's thresholds are illustrative, not proposals.

`[Proposed — unconfirmed]` In the code, these become Zod definitions that generate both TypeScript types and these JSON Schemas, so the published contract can't drift from the code. Version suffixes (`@0`) stay at 0 until the first published data exists.
