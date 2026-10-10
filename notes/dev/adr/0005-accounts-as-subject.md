# ADR-0005: The subject is an account (user or org) and its repos

- Status: Accepted
- Date: 2026-10-09

## Context

The idea began as a dashboard to show who I am and what I do as a developer. Repos are evidence about the account that owns or contributes to them. In GitHub's API, users and orgs are both accounts that own repos.

## Decision

- The primary subject is an account, user or org. Repos are subjects too, and evidence about accounts.
- Signals switch on by account type: person-only signals (contributions and reviews in others' projects, the contribution graph) for users; org-only signals (members, cross-repo patterns) for orgs.

## Consequences

- A solo developer and a small org can be compared on the signals they share, which matters for Sponsors comparisons, since some well-sponsored projects are run as orgs.
