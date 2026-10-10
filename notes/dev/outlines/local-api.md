# Local API and MCP (outline)

Status: outline, 2026-10-09. The local headless mode is decided ([ADR-0012](../adr/0012-neovim-principles.md)); every endpoint and tool below is `[Proposed — unconfirmed]`. The full OpenAPI document gets written once the core's data model settles ([RFC-0001](../rfc/0001-evidence-metrics-lenses.md)).

## Shape

- Served by the CLI (`<tool> serve`) on `localhost` only, never bound to other interfaces.
- JSON over HTTP, design-first: the OpenAPI document is the source, not generated after the fact.
- Uses the CLI's token and cache; never accepts a token from a client.
- Read-only. Nothing in the API writes to GitHub.

## Endpoints

| Method and path | Returns |
| --- | --- |
| `GET /subjects/{type}/{id}` | Basic subject info; `type` is user, org or repo |
| `GET /subjects/{type}/{id}/evidence?metric=&since=` | Evidence records |
| `GET /subjects/{type}/{id}/view?lens=` | Dimensions, panels and coverage under a lens |
| `GET /compare?a=&b=&lens=&align=calendar\|age` | Two views on shared scales |
| `GET /today?account=` | The Today view: attention items, CI, feed |
| `GET /lenses` | Installed lenses with IDs and versions |
| `GET /metrics` | The metric registry |
| `GET /budget` | Remaining rate limit and planned cost of a request |

## MCP tools

Mirror the endpoints as read-only tools: `get_subject`, `get_evidence`, `view_subject`, `compare`, `today`, `list_lenses`. Text that came from GitHub (titles, bios, messages) is returned in clearly labelled data fields ([threat model](../threat-model.md)).

## To decide

- Streaming progress for long fetches (server-sent events or polling).
- Whether the TUI talks to the core directly or through this API.
- Versioning: path prefix (`/v0/`) or a header.
