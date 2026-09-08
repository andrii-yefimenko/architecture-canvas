# 0002 — 2D spatial canvas blocks

**Status:** Accepted
**Date:** 2026-09-08

## Context

The Canvas has been a nested-list rendering since the MVP: `Node` (`src/domain/types.ts`) is `{id, serviceId, children}` with zero positional data, and `Canvas.tsx`/`CanvasNode.tsx` render it as plain flexbox divs with padding-based indentation for depth — not a spatial surface. Drop-target resolution works by sorting every overlapping droppable by DOM nesting depth (`collision.ts`'s `deepestDroppableFirst`), because every Node is simultaneously draggable and droppable and their DOM rects overlap by construction. There is deliberately no valid/invalid drop hinting, and no container/leaf distinction on `Service` — the type comment is explicit that there's "no `isContainer` flag" because any Node may legally contain any other (FR-012), including structurally nonsensical placements like a VPC inside a database.

The goal is a Canvas that reads like AWS CloudFormation / Application Composer: resizable Frames for VPC/subnet-style Services, compact Cards for leaf Services like EC2/RDS/ALB, positioned in free 2D space rather than a vertical tree. This was worked through as a Brainstorm/Grill session (per `docs/agents/plan.md`) across ten questions; every one resolved to the recommended option, so this ADR is that resolution, not an open question.

**Terminology** (resolved in a follow-up pre-spec Grill/domain-modeling pass, folded in here rather than left to drift): the two on-canvas renderings introduced by this ADR are canonical in `CONTEXT.md` as **Frame** and **Card**, and the position/size data as **Layout**. "Container" stays reserved for this domain's real AWS/Docker meaning (ECS, Fargate) and is never used for the rendering concept — including in code, where the field below is `'frame' | 'card'`, not `'container' | 'card'`.

## Decision

1. **Containment stays structural.** The `children` array remains the sole source of truth for parent-child relationships. Pointer position at drop time is used only to resolve which Frame the drop lands in, then feeds the same `MOVE_NODE`-shaped mutation the reducer already has. The evaluator, [ADR-0001](0001-client-side-validation-engine.md), and Domain Purity are untouched — this is a presentation-layer change, not a domain one.
2. **Fixed viewport for v0.3.0.** Free-form x/y placement within today's Canvas panel bounds. No pan, no zoom, no minimap.
3. **`Service` gains a `renderKind: 'frame' | 'card'` field.** A VPC always renders as a Frame, even empty; an EC2 always renders as a compact Card. Both `challenge-01.ts` and `challenge-02.ts`'s catalogs (~40 entries total) need this field populated.
4. **Free placement with grid-snap only.** Cards snap to a small grid for tidiness; the canvas never blocks or auto-rearranges an overlapping drop. No overlap-avoidance algorithm.
5. **Layout data lives in a new state-layer map** — `Map<NodeId, Layout>` (`Layout = {x, y, width, height}`), parallel to `canvasTree`, not fields on the domain `Node` type. Deleting or moving a Node must keep this map in sync; the domain layer and its existing tests are unaffected.
6. **Frames auto-size to fit their children** — bounding box plus padding, recalculated on every add/move/delete, with a minimum size for an empty Frame. No manual resize handle in v0.3.0.
7. **Reparenting drops a card wherever the pointer lands**, translated into the new parent's local coordinate space, rather than resetting to a default slot.
8. **Keyboard support stays coarse for v0.3.0.** A keyboard user can select a Service and assign it into a chosen Frame at a default position; pixel-level keyboard repositioning is deferred.
9. **Layout is persisted.** The Layout map joins `PersistedSession` alongside `canvasTree`/`revealedCategories`, under the existing per-Challenge storage key, with `SESSION_VERSION` bumped — the existing all-or-nothing discard-on-mismatch behavior applies unchanged.
10. **A Node with children always renders as an auto-sized Frame, regardless of its Service's `renderKind`.** `renderKind` only picks the empty-state appearance. This preserves FR-012's "any node may contain any other" guarantee with no new restriction and no spec amendment — it reuses decision 6's auto-size rule uniformly, rather than adding drop validation that doesn't exist today.

**Explicitly deferred**, logged in `docs/03-BACKLOG.md`: pan/zoom and a minimap, manual Frame resize, full keyboard-driven fine-grained repositioning, and collision/overlap-avoidance.

## Consequences

**Bumping `SESSION_VERSION` discards every existing persisted session**, across both Challenges, on upgrade — the same all-or-nothing behavior the persistence layer already applies to any shape change, not a new risk class.

**~40 Service catalog entries need a `renderKind` value.** Additive data change; no Rule, evaluator, or Score behavior changes as a result.

**`collision.ts` needs a full rewrite** — from DOM-depth collision sorting to spatial-rect resolution against the new Layout map (does the pointer's canvas-space position fall within a Frame's bounds, and not within any of its children's bounds).

**`Canvas.tsx`/`CanvasNode.tsx` need a substantial rewrite** — small today (~111 LOC combined), so cheap to replace, but the rendering model changes from nested-flex indentation to absolute-positioned frames and cards driven by the layout map.

**Domain layer, evaluator, and both Challenges' Rules are unaffected.** Containment is still the `children` array; Additive Evolution and Domain Purity both hold by construction, not by extra care taken during implementation.

**Existing Canvas/CanvasNode/collision tests will need rewriting**, not just updating, to match the new rendering and drop-resolution model. This is expected engineering cost — Additive Evolution protects Challenge playability, not test-file stability.
