# Homepage UI Approval

Status: Gate B1 and Gate B2 approved on 2026-07-19.

The Phase 2 mockup is rendered by the production client entrypoint using the
same components, tokens, and deterministic fixtures intended for the later
application shell. It is not a disconnected design drawing.

## Reproduce the current fixture UI

From `homepage/`:

```bash
npm ci
npm run build
NODE_ENV=production PORT=3100 npm start
```

Open `http://127.0.0.1:3100/` and review every fixture route at:

- desktop width, such as 1440 × 1000;
- tablet width, such as 800 × 1000; and
- mobile width 320 × 900.

Use the appearance selector for `DARK`, `LIGHT`, and `AUTO`. Review Overview,
Compute, Network, Storage/Backups, Kubernetes, OKD, Services, and Weather.
Expand a Proxmox panel; search for `UniFi`; use `/`, arrows or `h`/`j`/`k`/`l`,
number keys, Enter, Shift+Enter, Esc, and `?`; and verify the `Layout` control
persists navigation/density/overview preferences in this browser. The page
includes healthy, warning, stale, critical, no-data, not-provisioned, and
not-supported examples.

## Intended visual decisions

- Dark mode uses the approved btop-derived values from the architecture,
  including black background, compact monospace typography, muted dividers, and
  the approved CPU/memory/network/workload box colors.
- Light mode is an accessible proposed palette rather than a literal inversion.
- State uses text labels and border treatment in addition to color; `STALE`,
  `NO DATA`, `NOT PROVISIONED`, and `NOT SUPPORTED` are explicit.
- Panels use CSS Grid with `minmax(0, 1fr)`, collapse to one column at 520px,
  and expose keyboard/pointer expansion plus a labeled `Open ↗` action.
- The Overview uses two separate btop-inspired Proxmox monitor cards. Each
  card has a tall CPU graph and stat box followed by its own memory, disk, and
  network regions. Services retains the compact process-list treatment below.
- CPU, memory, disk/available, network download, and network upload graphs use
  separate dense Braille styles with the corresponding btop gradient families:
  CPU green/yellow/red, memory used red, disk available amber, download purple,
  and upload magenta.
- The CPU host lanes now use six text rows (24 vertical Braille-dot levels),
  following btop's row-band graph algorithm. Memory, disk, and network traces
  use two text rows (eight dot levels) in their smaller boxes.
- CPU graph rows map low-to-high utilization as green, green/yellow, yellow,
  yellow/red, then red, matching btop's CPU gradient direction.
- SVG sparklines expose one concise screen-reader summary rather than every
  point. The dot graph now uses a dense 2×4-dot Unicode Braille cell per sample,
  with a 256-level glyph ramp and a text summary alongside the visual glyphs.
- The mockup deliberately keeps the component gallery visible below Overview so
  state and typography variants can be judged in one screen.

## Gate B2 review checklist

| Review item | Decision |
|---|---|
| Desktop, tablet, and mobile shell composition | Approved |
| Dark, light, and auto appearance | Approved |
| Information density and browser-local layout controls | Approved |
| Every routed fixture view | Approved |
| Search ranking, keyboard behavior, and focus | Approved |
| Braille graph readability and mobile behavior | Approved |

Owner: Sean  Date: 07/19/2026

Required revisions / notes: None. Gate B2 approved; Phase 3 integrations may begin.

## Historical B1 notes

- The current application remains entirely fixture-backed; live telemetry and
  integration adapters are intentionally not part of this approval gate.
- The visual implementation uses CSS/SVG primitives and Unicode Braille cells.

## Visual evidence

Automated build and responsive CSS checks are available through the commands
above. The owner reviewed the desktop and mobile compositions locally.

| Review item | Decision |
|---|---|
| Desktop composition and information density | Approved |
| 320px mobile composition | Approved |
| Dark appearance and exact dark tokens |  Approved |
| Proposed light appearance and contrast |  Approved|
| Graph style and accessible summaries | Approved — multi-row, responsive btop-style Braille cells |
| Healthy/degraded/stale/not-provisioned state language | Approved |

Owner: Sean____________________  Date: 07/19/2026

Required revisions / notes: None. Proceeded to HP-008 after this approval.
