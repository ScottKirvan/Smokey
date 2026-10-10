# SBOM and supply chain (outline)

Status: outline, 2026-10-09. Everything here is `[Proposed — unconfirmed]`.

## Why

The tool judges other projects' release hygiene and supply-chain practices. It should pass its own checks, and its Actions run with write access in users' repos.

## Plan

- Generate an SBOM for each release in CycloneDX or SPDX from the pnpm lockfile, in CI.
- Attach it to the GitHub release, and sign it and the built artifacts with artifact attestations.
- Pin every third-party action in the tool's own workflows to a commit SHA.
- Dependency automation (Dependabot or Renovate) with the same review standards the lenses reward.
- Run the tool's own lenses against its repo in CI as a dogfooding check.

The release pipeline this plugs into is designed in [RFC-0003](../rfc/0003-build-release-delivery.md#supply-chain).

## To decide

- CycloneDX or SPDX.
- Whether Action releases are published as a separate repo per Action or from the monorepo. The GitHub Marketplace lists only one action per repo, from an `action.yml` at its root (checked 2026-10-09); options in [RFC-0003](../rfc/0003-build-release-delivery.md#releasing).
