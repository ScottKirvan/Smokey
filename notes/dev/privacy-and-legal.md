# Privacy and legal notes

Status: draft, 2026-10-09. These are design notes, not legal advice. Anything here that decides behaviour is `[Proposed — unconfirmed]` unless it cites an ADR.

## Where data goes

| Flow | Who processes it | Stored where |
| --- | --- | --- |
| Viewer looks up an account in the explorer | The viewer's browser, calling GitHub directly | Viewer's browser cache only |
| User runs the CLI or local API | The user's machine | User's disk cache only |
| Owner's snapshot workflow | The owner's GitHub Actions | The owner's own repo |
| Card kit | The owner's GitHub Actions | The owner's profile repo |

The project runs no server and keeps no data ([ADR-0003](adr/0003-no-database-no-hosted-server.md)). Nothing about any account passes through infrastructure the project owns.

## Profiling public data

Anyone can look up any account's public data ([ADR-0009](adr/0009-public-lookup-no-paid-tier.md)). Under the EU's GDPR, compiling public information into a profile of a person is still processing personal data. With no server, that processing happens on the viewer's own device, at their request; the project isn't holding or distributing profiles.

What would change that picture, and so needs a fresh look first:

- any hosted component that fetches, caches or serves data about accounts;
- a public index or leaderboard built from many accounts;
- publishing other people's data rather than your own.

`[Proposed — unconfirmed]` Even without a server, the explorer should say plainly what data it uses and where it comes from, and the docs should explain how someone can limit what's visible (GitHub's own privacy settings, not publishing snapshots).

## Automated hiring rules

Several jurisdictions regulate tools used to screen or rank job candidates. Examples include New York City's Local Law 144, which requires bias audits of automated employment decision tools, and the EU AI Act, which treats AI used in recruitment as high-risk. These obligations fall mainly on the makers and deployers of tools sold or used for screening.

This design stays well away from that territory:

- It isn't sold or packaged for hiring ([ADR-0009](adr/0009-public-lookup-no-paid-tier.md)).
- It never produces a single score or ranking of a person ([ADR-0006](adr/0006-no-headline-score-for-people.md)).
- Every judgment is labelled with the lens that produced it ([ADR-0013](adr/0013-labelled-judgments.md)).

`[Proposed — unconfirmed]` Revisit with a lawyer before adding any hiring-specific feature: candidate lists, ranking several people, team accounts, or anything marketed to recruiters.

## Owners' published data

- Publishing is opt-in, per dataset ([ADR-0011](adr/0011-open-published-data.md)).
- `[Proposed — unconfirmed]` Traffic referrers and popular paths can reveal where links were shared (private wikis, internal tools). Default traffic to unpublished, and show owners a preview of exactly what will be public before enabling.
- Data committed to a public branch stays in git history after it's removed from the current files. The docs must say so before anyone enables publishing.

## Third-party terms

- GitHub's API terms apply to all collection; the tool stays within documented endpoints and rate limits.
- Sources with paid or restricted APIs are out ([ADR-0004](adr/0004-github-only-public-endpoints.md)).
- External-score plugins must respect each site's terms; a site that forbids automated access isn't used.
