# Quickstart & Validation Guide: 2D Spatial Canvas Blocks

**Date**: 2026-09-08 | **Plan**: [plan.md](./plan.md)

How to run the application and prove it satisfies this feature's specification. Written to be executable once implementation lands — nothing here exists yet. Prerequisites and run commands are unchanged from `specs/001-architecture-canvas-mvp/quickstart.md`.

## Prerequisites

- Node.js 20+ and npm (local development)
- Docker 20.10+ and Docker Compose 2.0+ (container run)
- A modern desktop browser

## Running

```bash
npm install
npm run dev          # Vite dev server, hot reload
```

```bash
npm test             # Vitest, single run
```

```bash
docker compose up --build -d   # then open http://localhost:3000
```

## Validation scenarios

Each scenario maps to a user story in [spec.md](./spec.md).

### Scenario 1 — Place Services as Frames and Cards (US1, P1)

1. Start any Challenge. **Expect**: an empty, scrollable Canvas panel (no vertical list, no "Drag Services here" text shrunk into a corner).
2. Drag VPC onto the empty Canvas. **Expect**: a visibly large, bordered Frame appears at the drop point, at least `MIN_FRAME_SIZE` even though it's empty.
3. Drag EC2 (Backend) onto the empty Canvas, away from the VPC. **Expect**: a small, fixed-size Card appears at the drop point — visually distinct from the Frame in step 2 without reading either label.
4. Drag RDS into the VPC Frame from step 2. **Expect**: the drop is accepted, RDS appears inside the Frame, and the Frame's bounds grow to enclose it plus padding.
5. Drag another Service into the EC2 (Backend) Card from step 3 (a structurally odd placement, but permitted per `FR-011`). **Expect**: the Card is accepted as a drop target and immediately renders as an auto-sized Frame instead of a Card — the drop is never rejected.

### Scenario 2 — Reposition and reparent freely (US2, P1)

1. Place a VPC Frame and, separately, a Public Subnet Frame, side by side on the Canvas.
2. Drag EC2 (Frontend) into the Public Subnet Frame.
3. Drag that EC2 (Frontend) Card out of the Public Subnet Frame and into the VPC Frame directly, releasing at a specific point inside it. **Expect**: it lands at that point (not snapped to a corner or a default slot), and the Public Subnet Frame shrinks back toward its empty-state size.
4. Drag the Public Subnet Frame itself (its whole body, not a child) to a new position on the Canvas. **Expect**: nothing was inside it (per step 3) — the Frame moves alone. Repeat with a Frame that still has a child inside it: the child visibly moves with it, landing in the same relative spot.
5. Drag one Card directly on top of another sibling Card. **Expect**: the drop is accepted; both remain visible, overlapping — nothing is blocked or nudged aside.

### Scenario 3 — Layout survives a reload, scoped per Challenge (US3, P2)

1. On Challenge #1, arrange several Nodes at deliberate, spread-out positions (some nested, some at root).
2. Reload the page. **Expect**: every Node reappears in exactly the same visual arrangement — not just the same tree structure, the same positions.
3. Navigate directly to Challenge #2 (type the URL). **Expect**: Challenge #2's Canvas is completely empty — no Nodes, no leftover positions from Challenge #1, even though both catalogs share Service ids like `vpc`.
4. Navigate back to Challenge #1. **Expect**: the arrangement from step 1 is restored exactly.

### Scenario 4 — Keyboard-only placement (US4, P3)

1. Using only the keyboard (no mouse/trackpad), Tab to a Service in the Services panel.
2. Activate it and select a target Frame (or the Canvas root) via keyboard. **Expect**: a new Node appears inside the chosen target at a default position.
3. Repeat twice more into the same Frame. **Expect**: each of the three Nodes lands at a visibly distinct position — never stacked exactly on top of a previous one.

## Edge cases to verify manually

| Case | Expected |
|---|---|
| Arrange enough Nodes to exceed the Canvas panel's visible height | The panel becomes scrollable (ordinary scroll, mouse wheel or scrollbar); every Node remains reachable — no pan/zoom controls appear |
| Delete a Frame with several nested Nodes | Cascade-delete proceeds exactly as today (confirmation prompt first); none of the deleted Nodes' positions linger in a later `layout` inspection |
| Submit a Canvas Tree built entirely via the new spatial interactions, matching a Challenge's expected architecture | Scores exactly 100, identically to the same structural tree built via drag order alone — confirms position never affects Score (`FR-018`) |
| Two browser tabs open on different Challenges, each with a spatial arrangement | Each tab's Canvas reflects only its own Challenge's positions — no cross-tab bleed, same as spec 002's session isolation |
| A session saved before this feature shipped (`version: 1`, no `layout` field) is present when the app loads | Discarded; Challenge starts clean — matches the existing version-mismatch behavior, now triggered by the `1` → `2` bump |

## Definition of done

- [ ] `npm test` passes, including the 15 canvas-layout contract cases ([contracts/canvas-layout.md](./contracts/canvas-layout.md)), the 19 persistence contract cases ([contracts/persistence.md](./contracts/persistence.md)), and the extended challenge-authoring integrity check ([contracts/challenge.md](./contracts/challenge.md))
- [ ] All four validation scenarios above pass
- [ ] `docker compose up --build -d` serves both Challenges, playable end to end with the new spatial Canvas, at `localhost:3000`
- [ ] A Canvas Tree matching either Challenge's expected architecture, built via the new spatial interactions, scores exactly 100
- [ ] No user-observable regression to any behavior verified in `specs/001-architecture-canvas-mvp/quickstart.md` or `specs/002-multi-challenge-catalog/quickstart.md` beyond the intentional visual redesign itself
