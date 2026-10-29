# Bandha UI System — AAS–AIM application expression (Phase 46.32)

## Source of truth
The Bandha corporate website direction (V14, evidenced in V26 `bandha-v26-inside-an-analysis.html`) is **one identity, two expressions**: services have open editorial paper, software has compact technical grids. Navigation, palette, typography must share a family.

## Exact inherited choices
| Token | Value | Usage |
|---|---|---|
| Paper | `#f5efe6` | Application page |
| Paper 2 | `#efe5d8` | Subtle alternate surface |
| Ink | `#35291f` | Text and headings |
| Copper | `#925436` | Primary action, active detail |
| Walnut | `#30251f` | Sidebar / dark emphasis |
| Walnut 2 | `#453329` | Sidebar interaction |
| Grid | `#8c654f38` in corporate source | Fine technical graph-paper motif |
| Hairline | `#ceb9a5` | Borders |

Fonts: `DM Sans` for functional information and `Instrument Serif` for editorial display moments, with locally available fallbacks. Google Fonts load when online; no fonts are bundled or exported.

## Application-specific decisions
Functional color remains secondary to explicit labels: COR muted sage, INS plum, user drafts copper. Do not use copper alone to suggest approval. Use light paper data surfaces, readable forms, restraint in shadows and motion. Brand styling does **not** create source authority, server submission or technical correctness.

## Architecture and caveat
Phase 46.32 translates legacy hardcoded utility colors to Bandha design role tokens globally and adds explicit component/shell overrides in `apps/aim-next/src/styles.css`. Preserve the token block for future design work; move more components to direct tokens when next edited. Color migration is substantial and needs a fully mounted visual audit in the pinned build environment before any release claim.
