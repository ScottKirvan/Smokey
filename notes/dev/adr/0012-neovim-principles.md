# ADR-0012: Adopt Neovim-style principles

- Status: Accepted
- Date: 2026-10-09

## Decision

Adapted from Neovim's project principles:

1. **Work as a component:** support embedding as a primary use case.
2. **Work as a platform:** let users extend the core without limits.
3. **Work as a server:** enable new, modern UIs.
4. **Work in the terminal:** the TUI experience should be like any modern GUI.

With no hosted server, "work as a server" means both a **local headless mode** (the CLI exposes the analysis over a local API and MCP) and the **snapshot workflow** (the stateful part, running on GitHub's schedule).

## Consequences

- The core is a library with no assumptions about where it runs.
- Built-in collectors, lenses and visuals use the same extension points as third-party ones.
- Extending how data is judged is unlimited, but judgments are always labelled ([ADR-0013](0013-labelled-judgments.md)).
- A full TUI is in scope.
