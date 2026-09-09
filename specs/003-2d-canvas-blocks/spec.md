# Feature Specification: 2D Spatial Canvas Blocks

**Feature Branch**: `003-2d-canvas-blocks`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "" — no arguments were provided when `/speckit-specify` was invoked; this description is derived from a Brainstorm/Grill session earlier in this conversation (three rounds, ten questions, every recommendation accepted), which the user explicitly asked to run before this spec and which was captured as `docs/adr/0002-2d-spatial-canvas-blocks.md` and a Decision Log entry in `docs/02-PLAN.md`.

**Ground truth**: `PROJECT.md`, `CONTEXT.md`, `docs/02-PLAN.md`, `docs/adr/0002-2d-spatial-canvas-blocks.md`, `docs/03-BACKLOG.md`, and `specs/001-architecture-canvas-mvp/` + `specs/002-multi-challenge-catalog/` (the shipped Canvas this feature redesigns).

**Terminology**: This specification uses the canonical vocabulary defined in `CONTEXT.md` — **Frame**, **Card**, **Layout**, plus the existing **Node**, **Canvas Tree**, **Service**, **Challenge**, **Rule**, **Evaluation**, **Score**. These are domain terms, not implementation names. "Container" is deliberately never used for the Frame/Card rendering concept — it stays reserved for this domain's actual AWS/Docker meaning (ECS, Fargate).

## Clarifications

### Session 2026-09-08

- Q: When a Frame grows automatically because a new child was dropped into it, and that growth would make it overlap a neighboring sibling it didn't overlap before, should the system nudge that sibling aside, or let the overlap happen the same way a direct manual drop is already allowed to? → A: Let it happen — resize-triggered overlap is treated exactly like drop-triggered overlap; no collision-avoidance logic is built for this milestone. Nudging siblings aside is deferred (`docs/03-BACKLOG.md`).
- Q: When the Nodes placed on a Canvas take up more space than the fixed Canvas panel can show at once, can the user scroll that panel to reach the rest, or does content past the edge simply become invisible? → A: Ordinary scrolling — the Canvas panel scrolls to reach content outside the visible area, keeping every Node reachable without adding pan/zoom of an infinite canvas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place Services as Frames and Cards in Free 2D Space (Priority: P1)

A user drags a Service onto the Canvas and sees it appear where they dropped it — not appended to the bottom of a vertical list. A VPC-like Service appears as a resizable Frame; a leaf Service like EC2 appears as a compact Card. A Frame with nothing in it is still clearly visible and a valid drop target; once something is dropped inside it, it grows to enclose its contents.

**Why this priority**: This is the entire premise of the redesign — everything else in this feature builds on Nodes actually occupying 2D space and looking like the AWS diagrams they represent. Without it, the milestone delivers nothing new.

**Independent Test**: Load a Challenge's Task Page, drag a Frame-kind Service and a Card-kind Service onto an empty Canvas, and confirm each renders in its distinct visual form at its drop position.

**Acceptance Scenarios**:

1. **Given** an empty Canvas, **When** the user drags a Frame-kind Service (e.g. VPC) onto it, **Then** a Frame appears at the drop position, at least as large as the minimum empty-Frame size.
2. **Given** an empty Canvas, **When** the user drags a Card-kind Service (e.g. EC2) onto it, **Then** a compact, fixed-size Card appears at the drop position.
3. **Given** a Frame with several Nodes inside it, **When** the user views the Canvas, **Then** the Frame's bounds enclose all of its children plus padding, without any child visually overflowing it.
4. **Given** a Card-kind Node with no children, **When** the user drops another Service inside it, **Then** it renders as an auto-sized Frame instead of its usual compact Card — the drop is accepted, not rejected.

---

### User Story 2 - Reposition and Reparent Nodes Freely (Priority: P1)

A user drags an already-placed Node to a new spot — either within its current Frame or into a different one — and it lands exactly where they drop it, keeping whatever it was carrying (its own children move with it).

**Why this priority**: Matches today's "move any Node anywhere" capability (spec 001's FR-012/FR-015), just spatial now instead of list-order. A redesign that can place Nodes but not rearrange them isn't a replacement for what already ships.

**Independent Test**: Place two Frames side by side, each with a Card inside; drag a Card from one Frame into the other at a specific point, and confirm it lands there and the original Frame no longer contains it.

**Acceptance Scenarios**:

1. **Given** a Card inside Frame A, **When** the user drags it into Frame B and releases it at a specific point, **Then** the Card becomes a child of Frame B, positioned at that drop point relative to Frame B.
2. **Given** a Node dragged onto empty space at the Canvas root, **When** it is dropped, **Then** it becomes a root-level Node positioned at the drop point.
3. **Given** two sibling Cards, **When** the user drags one to overlap the other, **Then** the drop is accepted and both remain visible — the Canvas neither blocks the drop nor auto-rearranges either Card.
4. **Given** a Frame containing several Nodes, **When** the user drags the Frame itself to a new position, **Then** all of its contents move with it, preserving their arrangement relative to the Frame.

---

### User Story 3 - Layout Survives a Reload, Scoped Per Challenge (Priority: P2)

Having spent time arranging a Canvas spatially, a user reloads the page and finds every Node exactly where they left it — not just structurally present, but visually in the same place. Switching to a different Challenge shows none of that arrangement.

**Why this priority**: Builds directly on the per-Challenge persistence already shipped in v0.2.0; the value is real but depends on User Stories 1 and 2 existing first, and losing a careful arrangement on reload — while not ideal — doesn't block using the feature once.

**Independent Test**: Arrange several Nodes spatially on one Challenge, reload the Task Page, and confirm identical positions; then visit a different Challenge and confirm its Canvas shows no trace of the first Challenge's arrangement.

**Acceptance Scenarios**:

1. **Given** a Canvas Tree with several Nodes at specific positions, **When** the page reloads, **Then** every Node reappears at the same position and size.
2. **Given** a stored session whose Layout data doesn't match the current schema, **When** the app loads, **Then** the session starts clean — no Nodes and no Layout — matching the existing all-or-nothing discard behavior for the Canvas Tree.
3. **Given** Challenge #1 has a saved spatial arrangement, **When** the user visits Challenge #2, **Then** Challenge #2's Canvas starts empty, with none of Challenge #1's Nodes or positions carried over.

---

### User Story 4 - Keyboard-Only Placement Into a Frame (Priority: P3)

A user who cannot use a pointer selects a Service and assigns it into a chosen Frame (or the Canvas root) using only the keyboard. It lands at a sensible default position; fine-grained repositioning by keyboard is not expected in this release.

**Why this priority**: Keeps the Canvas usable without a pointer, matching the accessibility baseline the MVP already established via its `KeyboardSensor`. It's lower priority than the spatial mechanics themselves because it deliberately trades full parity for a coarser, shippable interaction this release.

**Independent Test**: Using only the keyboard, select a Service from the catalog, choose a target Frame, and confirm a new Node is added inside it at a default position.

**Acceptance Scenarios**:

1. **Given** keyboard focus on a Service in the Services panel, **When** the user activates it and selects a target Frame (or the Canvas root) via keyboard, **Then** a new Node is added as its child at a system-determined default position.
2. **Given** a Node was just placed via keyboard, **When** the user checks what keyboard actions are available next, **Then** fine-grained repositioning is understood to be unavailable by keyboard in this release, not a malfunction.

---

### Edge Cases

- **Dropping into a Card, not a Frame**: Per User Story 1's Acceptance Scenario 4, this is accepted and promotes the Card to a Frame — never rejected. Any Node may still contain any other Node, unchanged from spec 001's FR-012.
- **Drop point ambiguity near a Frame's edge**: A drop resolves to whichever Frame's bounds contain the point, or the Canvas root if none do — never both a Frame and its parent simultaneously.
- **Deleting a populated Frame**: Cascades exactly as today (spec 001's FR-016/FR-017, including the confirmation prompt); every deleted Node's Layout is removed along with it, not left orphaned.
- **Reload with a Layout entry for a Node that no longer validates** (e.g. a Service id renamed since the session was saved): Discarded as part of the same all-or-nothing envelope check that already applies to the Canvas Tree — no partial Layout restore.
- **Fixed viewport, scrollable**: A Node placed near or beyond the edge of what's initially visible remains reachable by scrolling the Canvas panel. There is no panning or zooming of an infinite canvas, and no zoom-to-fit, in this release; whether the panel scrolls automatically while a drag is in progress near its edge is left to `/speckit-plan`.
- **Frame growth overlapping a sibling**: When a Frame auto-resizes to enclose a new child and this makes it overlap a neighboring Node, the overlap is accepted exactly like a direct drop — the sibling is never nudged or rearranged automatically.
- **Keyboard placement into a crowded Frame**: The default position is deterministic even when the Frame already has several children — never silently off-canvas or indistinguishable from an existing Node.

## Requirements *(mandatory)*

### Functional Requirements

**Node rendering — Frame vs. Card**

- **FR-001**: System MUST render each Node as either a Frame or a Card, determined by its Service's designated appearance, except where FR-002 applies.
- **FR-002**: A Node with at least one child MUST always render as an auto-sized Frame, regardless of its Service's designated appearance.
- **FR-003**: A Frame MUST auto-size to enclose all of its children plus padding, recalculated whenever a child is added, moved, or removed.
- **FR-004**: An empty Frame MUST render at no smaller than a defined minimum size, remaining a clearly visible, valid drop target.
- **FR-005**: A Card MUST render at a fixed, compact size while it has no children.

**Placement & movement**

- **FR-006**: System MUST allow any Node to be positioned anywhere on the Canvas via free-form placement, not confined to a fixed list order or to whatever fits on screen without scrolling.
- **FR-007**: Dropping a Service onto the Canvas MUST create a new Node at the drop position, contained by whichever Frame's bounds contain that position, or placed at the Canvas root if none do.
- **FR-008**: Moving an existing Node to a new position within its current parent MUST change only where it's drawn, not its place in the Canvas Tree's structure.
- **FR-009**: Dragging a Node into a different Frame (or onto the Canvas root) MUST reparent it in the Canvas Tree exactly as containment already works today (spec 001's FR-015/FR-016 for cascading moves and deletes), and position it at the drop point relative to its new parent.
- **FR-010**: Placed Nodes MUST snap to a fixed grid increment; the system MUST NOT block, reject, or automatically rearrange a Node's position — whether from a direct drop or from a Frame's own auto-resize newly overlapping a sibling — solely because it results in overlap with another Node.
- **FR-011**: System MUST continue to allow any Node to be dropped into any other Node with no structural placement restriction, unchanged from spec 001's FR-012.

**Persistence**

- **FR-012**: System MUST persist every Node's position and size alongside the Canvas Tree, scoped to the current Challenge exactly as the Canvas Tree already is.
- **FR-013**: Restoring a persisted session MUST restore every Node's position and size identically to how it was left, together with the existing Canvas Tree and revealed-Category restoration.
- **FR-014**: A persisted session whose spatial data doesn't match the current schema MUST be discarded in full, starting a clean session — consistent with the existing all-or-nothing rule already applied to the Canvas Tree (spec 001's FR-033).
- **FR-015**: Deleting a Node MUST also remove its position/size data, and that of every descendant removed in the same cascade.

**Keyboard accessibility**

- **FR-016**: System MUST allow a keyboard-only user to select a Service and assign it as a new Node into a chosen Frame, or the Canvas root, at a system-determined default position.
- **FR-017**: System MUST NOT require pointer input to place at least one instance of every Service available in a Challenge's catalog somewhere valid on the Canvas.

**Stability of existing behavior**

- **FR-018**: The Evaluation engine MUST continue to evaluate only the Canvas Tree's parent-child structure; a Node's position or size MUST NOT affect any Rule's pass/fail outcome or the Score.
- **FR-019**: All Rules, scoring, and existing per-Challenge behavior defined in `specs/001-architecture-canvas-mvp/spec.md` and `specs/002-multi-challenge-catalog/spec.md` MUST continue to hold unchanged.

**Viewport & scrolling**

- **FR-020**: The Canvas panel MUST be scrollable, so a user can reach any placed Node even when the arrangement occupies more space than is visible at once, without requiring pan or zoom.

### Key Entities

- **Frame**: The on-canvas rendering of a Node as a resizable container, auto-sized to enclose its children. Applies to any Node with at least one child, and to an empty Node whose Service is designated Frame-kind.
- **Card**: The on-canvas rendering of a Node as a compact, fixed-size square. Applies only to an empty Node whose Service is designated Card-kind.
- **Layout**: A Node's position and size on the Canvas. Presentation data only — no Rule ever evaluates it — but persisted alongside the Canvas Tree per Challenge.
- **Node** *(extended)*: Per `specs/001-architecture-canvas-mvp/spec.md`, now additionally associated with a Layout; its identity, parent, and children are unchanged.
- **Service** *(extended)*: Per `specs/001-architecture-canvas-mvp/spec.md`, now additionally designates whether it renders as a Frame or a Card by default.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can tell, at a glance and without reading any label, whether a given Node is container-style or leaf-style, for 100% of Nodes on the Canvas.
- **SC-002**: A user can place, move, and reparent any Node to their intended location using only drag gestures, landing within one grid-snap increment of where they released it.
- **SC-003**: After a page reload, 100% of previously placed Nodes reappear in the same visual arrangement they were left in.
- **SC-004**: A Canvas Tree built entirely through the new spatial interactions produces the same Score as the identical structural tree built through the prior list-based interaction — confirming spatial arrangement never influences the Score.
- **SC-005**: A keyboard-only user can add every Service in a Challenge's catalog onto the Canvas without touching a pointer device.
- **SC-006**: Building a spatial arrangement on one Challenge and then visiting a different Challenge never shows any Node or arrangement from the first Challenge, extending `specs/002-multi-challenge-catalog/spec.md`'s SC-004 to spatial data.
- **SC-007**: A user can reach and interact with every placed Node regardless of how much space the arrangement occupies, by scrolling the Canvas panel.

## Assumptions

**Scope**

- This feature covers the Canvas's rendering and interaction model only. It does not add pan/zoom, a minimap, manual Frame resizing, full keyboard-driven fine-grained repositioning, or collision/overlap-avoidance — all explicitly deferred in `docs/adr/0002-2d-spatial-canvas-blocks.md` and logged in `docs/03-BACKLOG.md`.
- Exact grid-snap increment, minimum Frame/Card dimensions, and the keyboard-placement default position are implementation details left to `/speckit-plan`, not fixed by this spec.
- Both existing Challenges (#1 and #2) receive a Frame-or-Card designation for every Service in their catalogs; neither Challenge's Requirements, Rules, or content otherwise change.
- Desktop-first, matching the environment assumptions already stated in `specs/001-architecture-canvas-mvp/spec.md`.

**Pre-decided technical constraints** *(settled in `docs/adr/0002-2d-spatial-canvas-blocks.md`; recorded here as inputs, with elaboration belonging to `/speckit-plan`)*

- Containment remains the Canvas Tree's `children` array; a Node's position and size never redefine parent-child structure.
- Layout data lives in a new state-layer store, not as fields on the domain Node — the domain layer and evaluator are unmodified by this feature.
- Persisting Layout requires a session-schema version increase, which — per the existing persistence contract — discards every previously stored session across both Challenges.
- Every Service gains a two-valued designation (Frame or Card) for its default, empty-state appearance.

**Environment**

- Same environment assumptions as `specs/001-architecture-canvas-mvp/spec.md`: current desktop browser, JavaScript enabled, drag-and-drop support.

## Dependencies

- Depends on the existing Canvas Tree, evaluator, and per-Challenge persistence from `specs/001-architecture-canvas-mvp/` and `specs/002-multi-challenge-catalog/`; this feature extends rather than replaces them.
- `docs/adr/0002-2d-spatial-canvas-blocks.md` is authoritative for the architectural decisions this spec operationalizes.
- `CONTEXT.md` is authoritative for the terminology (Frame, Card, Layout) introduced for this feature.
