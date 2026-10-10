# Design tokens (outline)

Status: outline, 2026-10-09. Everything here is `[Proposed — unconfirmed]`.

## Why early

The same visuals render in four places: the explorer (CSS), card-kit SVGs on GitHub (light and dark), the TUI (terminal colours), and HTML for personal sites. Shared tokens keep them consistent and let the card match a reader's GitHub theme.

## Starting point

Smokey's CSS custom properties are the seed (see the token table in `CLAUDE.md`):

- **Status:** `--accent`, `--good`, `--warn`, `--ext`, `--ice`.
- **Issue chart:** `--bug-*`, `--feat-*`, `--misc-*` (core, tip, line), with Scott's neon palette in dark mode and grayscale in light mode.
- **Star chart:** `--star-1` … `--star-8`, a categorical palette that passes the dataviz validator in dark mode, with its own light set.

## Token groups

| Group | Contents |
| --- | --- |
| Color: surface and text | Backgrounds, borders, text levels |
| Color: status | Good, warning, failure, waiting |
| Color: categorical | Series colours for comparisons and multi-repo charts |
| Color: subject A / B | Two fixed colours for comparisons, kept distinct from categorical series |
| Color: controllable / context | A quiet distinction used across all lenses |
| Typography | Monospace family and sizes, as Smokey uses now |
| Spacing and radius | Panel padding, gaps, corner radius |
| Motion | Durations, with reduced-motion fallbacks (Smokey's sweep rules) |

## Outputs

| Target | Format |
| --- | --- |
| Explorer | CSS custom properties, light and dark |
| Card kit | Values inlined into SVG, one file per theme, paired with `<picture>` |
| TUI | Truecolor values with 256-colour fallbacks |
| Personal-site HTML | CSS custom properties, same as the explorer |

## To decide

- Tool: Style Dictionary, or a small in-repo script generating the four outputs.
- Whether the neon dark palette extends to new charts or stays specific to the issue chart.
