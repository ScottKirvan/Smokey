# User stories (outline)

Status: outline, 2026-10-09. Titles and acceptance criteria are `[Proposed — unconfirmed]`. Each story cites the requirement it serves ([requirements.md](../requirements.md)).

Template: **As** a role, **I want** a capability, **so that** an outcome. Acceptance criteria are checkable facts, not impressions.

## Worked example

**S-01 — See what needs me today** (R-T1, R-T2)

As a maintainer, I want one view of my repos that shows outside PRs and issues waiting on me, so that nothing sits unanswered.

- Given I've set my account and a token, the Today view lists every outside PR and issue with no maintainer response, newest first.
- Bots (`[bot]` authors, release-please) never appear.
- Each item links to the matching filtered GitHub page.
- With no token, the view still loads public data and shows how many requests remain this hour.

## To write

**Today**
- S-02 CI status at a glance across my repos
- S-03 Activity feed and notifications, opt-in

**Long term**
- S-04 My maintainer habits over the last 12 months
- S-05 Traffic and star history beyond GitHub's windows, from my snapshots
- S-06 Controllable signals separated from context

**Compare**
- S-07 My repo against a model repo: practice-adoption timeline
- S-08 My account against a sponsored developer's, under one lens
- S-09 Comparing with no token degrades gracefully and says so

**Lenses**
- S-10 Switch lens in the explorer
- S-11 Choose the lens for my card

**Snapshots and publishing**
- S-12 Set up the snapshot workflow from a template
- S-13 Choose which datasets are public, with a preview
- S-14 A viewer sees whether published data is verified

**Card kit**
- S-15 My profile README updates weekly with my card
- S-16 Light and dark variants match the reader's theme

**External scores**
- S-17 See which inputs would move my github-readme-stats rank
- S-18 Track an external score over time

**Terminal and agents**
- S-19 Run the Today view in the TUI
- S-20 Ask an agent about my repos through MCP

**Migration**
- S-21 My Smokey traffic and star history appears in the new tool after cutover
