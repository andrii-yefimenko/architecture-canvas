# RFC — Spatial Layout Engine

**Status:** Grilled — design resolved (§11); ready for implementation planning. One item remains genuinely open (§5.5's per-tick performance cost), to be validated during implementation rather than blocked on.
**Author's note:** This document intentionally does not decide anything. It exists to put the entire problem on the table at once, in one place, so the next design pass can stress-test it as a whole system instead of one symptom at a time.

## 1. Why this document exists

Between v0.3.6 and v0.3.7, Canvas collision/placement/push logic went through roughly six rounds of hands-on-testing patches (documented across ADR-0005, ADR-0006, and ADR-0007), and even after all six rounds, a new failure mode surfaced immediately: a Frame auto-expanding to fit a new child grows directly on top of an adjacent sibling Frame, because nothing in the system treats a Frame's own growth as an event that can conflict with anything.

This is a whack-a-mole pattern, not bad luck: every round fixed the exact symptom reported, using the smallest local change that fixed it, without re-deriving the problem from first principles. Each fix was individually well-reasoned and well-tested (see ADR-0007's six rounds for the reasoning trail), but the *composition* of six locally-correct patches kept producing new, previously-invisible failure modes at the boundaries between them. The current `src/state/layout.ts` — even reverted to its pre-round-3 baseline for this document — already shows the seams: placement, push-displacement, and Frame auto-sizing are three separate pieces of logic that each assume the other two aren't happening at the same time.

The working tree has been reverted to the last committed baseline (this repo's HEAD as of this RFC: v0.3.6's directional push displacement plus the already-committed nesting-threshold fix). All six rounds of the ADR-0007 push-calibration work are preserved in `git stash` (message: "v0.3.7 rounds 1-6 push-displacement iteration (superseded by RFC-driven redesign)") for reference, not deleted — the reasoning in it remains valuable even though the code is being set aside.

**Goal of this RFC:** describe the *whole* spatial-layout lifecycle — collision detection, drop-target resolution, placement, push-displacement, and Frame auto-expansion — as one coherent system with explicit invariants, so that whatever gets built next is designed to satisfy all of them simultaneously, rather than discovered by testing them one at a time.

**Explicitly out of scope for this document:** deciding the final algorithm. That's the job of the grill session this RFC feeds into. This document's job is to make sure that session has the full problem in front of it — every constraint, every known failure mode, and the current architecture's exact shape — before anyone proposes a fix.

## 2. Vocabulary

Uses `CONTEXT.md`'s canonical terms throughout (Node, Frame, Card, Layout, Canvas Tree). This RFC adds working vocabulary for concepts `CONTEXT.md` doesn't yet name, since they're implementation-level, not domain-level:

- **Sibling set** — the Nodes sharing one parent (or, for root-level Nodes, sharing the Canvas root as their common context). Push-displacement and overlap-avoidance are defined *within* a sibling set; a Node never needs to avoid overlapping a Node that isn't its sibling (an uncle, a cousin, its own parent) because containment already prevents that geometrically, *provided* every Frame's rendered box always fully encloses its children — which is exactly the invariant this RFC is worried about.
- **Gutter** — the minimum required clearance between two sibling Nodes' rendered boxes, currently `FRAME_PADDING` (16px), reused as both the Frame-border inset and the sibling clearance minimum.
- **Boundary** / **minPosition** — the hard floor a Node's Layout can never cross: `{0, 0}` for a root-level Node (the Canvas's own origin), or `{FRAME_PADDING, FRAME_PADDING}` for a Node inside a Frame (it can never render flush against its parent Frame's own border).
- **Significant overlap** — the (currently contested, six-times-recalibrated) threshold past which an overlap between two sibling rects is treated as a real conflict requiring resolution, as opposed to a tolerable graze. See §5.1.
- **Push-displacement** — moving a sibling Node's Layout to relieve a conflict, as opposed to moving the Node that triggered the conflict.
- **Auto-expansion** — a Frame's rendered size growing to enclose its children, purely as a function of those children's current Layouts and sizes (`computeContentSize`). Never itself writes to `layout` — it's recomputed from scratch on every call.
- **Cascade** — a chain reaction where resolving one conflict (a push, or a Frame's growth) creates a new conflict one level up or one sibling over, which itself needs resolving.

## 3. Current architecture (as of this repo's HEAD)

All of the following lives in `src/state/layout.ts` unless noted, and is a *pure function of its inputs* — nothing in this module reads or writes React state, dnd-kit state, or the reducer directly. `TaskPage.tsx` is the only caller, wiring dnd-kit's drag events to these functions and dispatching the result.

### 3.1 The primitives, and what each one knows about

| Function | Knows about | Doesn't know about |
|---|---|---|
| `computeContentSize(children)` | One Frame's own children's Layouts/sizes | That Frame's own position, or anything about its siblings |
| `computeNodeSize(node, layout, renderKindOf)` | Recursive children sizes (calls `computeContentSize`) | Siblings at any level |
| `rectsOverlap(a, b)` | Two rects, geometrically | Which Nodes they belong to, gutters, significance |
| `hasClearance(candidate, siblings)` | Whether `candidate` keeps a full gutter from *every* sibling in a given list | Nothing beyond that one list — has no concept of a parent Frame needing to grow to make room |
| `findFreePosition(desired, size, siblings, minPosition)` | How to search outward for the nearest fully-clear slot, bounded by `minPosition` | Push-displacement — never moves anything except the one Node being placed |
| `siblingRectsFor(tree, layout, renderKindOf, parentId, excludeNodeId)` | How to list one parent's current children as positioned rects | Whether any of those children's *own* rendered sizes are about to change |
| `hasSignificantOverlap(a, b)` | A geometric threshold, currently a pure percentage-of-smaller-area test (25%) | The Frame/Card distinction, boundaries, or anything about *why* two things overlap |
| `computePushDisplacements(droppedRect, siblings)` | How to push one sibling set's members apart, always toward `+X`/`+Y`, cascading up to `MAX_PUSH_CASCADE_DEPTH` (50) | `minPosition` at all (not threaded into this baseline) — a push toward the boundary is not prevented; also doesn't know a pushed sibling might now need to *grow* if it's a Frame with its own children extending past its old edge |
| `resolveDropPlacement(...)` | Composes the above into "where does the dropped Node land, and which direct siblings get pushed" | Anything about the dropped Node's *own future growth* if it's a Frame, or about its parent Frame needing to grow to fit it, or about that parent's *own* siblings |
| `meetsNestingThreshold` / `deepestDroppableFirst` (`src/components/canvas/collision.ts`) | Which Frame a drop's pointer/rect resolves to as the *parent* — a completely separate question from where the dropped Node lands *within* that parent | Placement, push, or growth at all |

### 3.2 The pipeline, today

For a real drop (`handleDragEnd` in `TaskPage.tsx`) or the live ghost preview (`handleDragOver`), the sequence is:

1. **Collision detection** (`deepestDroppableFirst`) resolves which Frame (or the Canvas root) the drop's `over` target is — a decision about *parentage*, made once, from the dragged rect's momentary geometry against every candidate ancestor's rect. This never re-runs after step 2 discovers the parent needs to grow.
2. **`resolveDropPlacement`** computes the dropped Node's own landing Layout (clamped to `minPosition`) and calls `computePushDisplacements` once, against that one parent's *current* direct children only.
3. **`computeDragPreviewSize`** (preview only) projects what the target Frame's size *would* become, folding in the pushed siblings' projected positions — but this projection is thrown away the moment the real drop commits; it doesn't feed back into step 2's push decision, and it goes exactly one level deep (the immediate target Frame), never checking whether *that* Frame's growth would collide with *its own* siblings.
4. **Dispatch** (`ADD_NODE` / `MOVE_NODE` with `position` + `displacedPositions`) writes the dropped Node's Layout and every pushed sibling's new Layout, atomically, in one reducer action.
5. **Render** re-derives every Frame's size from scratch via `computeNodeSize`/`computeContentSize`, using the now-updated `layout` map. Nothing re-checks this newly-derived size against anything.

The critical gap is between steps 2 and 5: a Frame's size is *never* a first-class fact the placement/push system reasons about while deciding what to do — it's an emergent side effect discovered only at render time, several steps after every placement decision has already been locked in. Any bug where "the Frame grew over its neighbor" is a direct consequence of this: growth has no collision-detection step at all, at any level.

### 3.3 What's *already* handled correctly (don't relitigate these)

- A Frame's size is always freshly derived, never stored or cached — so once positions are correct, sizes are automatically correct. This is solid and should stay.
- The `snapToGrid` / grid-alignment model is solid and uncontroversial; every round of prior work kept it unquestioned.
- `meetsNestingThreshold` / `deepestDroppableFirst`'s *parentage* decision (which Frame is the drop's target) is a separate concern from placement-within-that-parent, and should probably stay separate — conflating them was never the source of any of the bugs this session found. Keep this boundary.
- `findFreePosition`'s ring-search is a reasonable, already-tested way to find the nearest clear slot for *one* Node against a *fixed* set of siblings; it doesn't need to change, but its assumption (the sibling set doesn't move or grow while searching) needs to be true wherever it's reused.

## 4. Known failure modes (the whack-a-mole log)

Each of these was independently true at some point this session — most were fixed for their own narrow case and then either regressed by a later fix or exposed the next one. Treat this as the acceptance-test list for whatever design comes out of the grill session: it must resolve *all* of these at once, not sequentially.

1. **Gutter-grazing over-sensitivity.** A drop that only grazed a sibling's edge, or entered its gutter by a pixel, triggered the *same* full push as a direct hit.
2. **Push threshold not scaled to object size.** A flat pixel-penetration threshold is a meaningful fraction of a Card's width but trivial for a Frame; tuning it as a flat number breaks one size class to fix the other.
3. **Percentage-of-area threshold misjudging elongated overlaps.** Two Frames overlapping by a large fraction of one axis and a small fraction of the other (a corner clip, or two same-height Frames abutting side by side) can have a *real, visible* collision that's a small percentage of total area — a pure area-ratio test misses it regardless of which way it's tuned.
4. **Leniency correctly scoped to Cards, wrongly applied to Frames.** Whatever tolerance exists for a Card's boundary jitter does not have an equivalent case for Frames — two Frames overlapping at all, by any amount, is never an acceptable resting state, but a formula shared between both sizes will always either over- or under-tolerate one of them.
5. **A tolerated (non-pushed) overlap left a Node resting in a real, visible overlap or a zero/partial gutter.** "Don't push the sibling" was implemented as "do nothing", not as "the dragged Node still must not overlap" — these are different requirements and only one was met.
6. **Boundary-anchored sibling flung to the opposite side.** When the "correct" push direction is blocked by a boundary, silently redirecting the push to the only always-safe direction (away from the origin) can move a Node that was *not* the one blocking anything, far from where it was resting, past the dragged Node's own new position — visually nonsensical, and specifically wrong when the blocked sibling was anchored at that boundary on purpose (nothing else was ever pushing on it).
7. **A parent Frame's own growth is not itself a collision-checked event.** `computeContentSize` grows a Frame purely from its children's Layouts, with zero awareness of that Frame's *own* siblings. A Frame growing to fit a newly-placed or newly-pushed child can render directly on top of an adjacent sibling Frame, and nothing detects or resolves it — this is structurally guaranteed to keep happening for *any* growth-triggering change (new child, moved child, pushed child) until growth is treated as a collision the same way a direct drop is.

Failure mode 7 is the one that triggered this RFC — it's structurally different from 1-6 (all of which were calibration/heuristic problems within the *existing* push model) because it's a **missing step**, not a miscalibrated one: nothing today ever asks "does this Frame's new size fit where it currently sits, relative to its own siblings?"

## 5. Open design tensions

These are the specific places where prior rounds' fixes pulled in different directions, and where the grill session needs to land on one coherent answer rather than another local patch.

### 5.1 What triggers "this must be resolved" at all?

Every one of failure modes 1-4 is a symptom of trying to answer "is this overlap significant?" with a single geometric formula that has to work for Card-vs-Card, Card-vs-Frame, and Frame-vs-Frame simultaneously, at every possible aspect ratio and size pairing. The six ADR-0007 rounds kept discovering new shapes of overlap (deep-but-small-percentage, shallow-but-large-percentage, aligned-axis-vs-colliding-axis) that broke whatever single formula was in place. Open question: is "significant overlap" even the right frame, or should the trigger instead be **kind-aware from the start** (Frame-vs-Frame is categorically never tolerated; Card-involved is a separate, explicitly different rule) rather than one formula quietly special-cased after the fact?

**§10 bears on this:** the Author's Vision (§10.2) answers the *shape* of the question — three named tiers (Nesting / Push / Auto-snap) instead of one sliding formula — but doesn't yet supply the actual numbers. "Meaningful overlap" (Tier 2's trigger) and "shallow penetration" (Tier 3's trigger) are exactly the kind of qualitative language whose precise, kind-aware definition is where all six ADR-0007 rounds' difficulty actually lived. Naming three tiers doesn't by itself avoid repeating that struggle — see open item 5.6(1).

**Resolved, §11.1.**

### 5.2 Who yields — the dragged Node, the existing sibling, or something decided per-case?

Three different answers have been used across this session, for three different triggers, without a unifying principle:
- ADR-0005's original model: the existing sibling always yields (pushed), the dragged Node always wins its drop coordinates.
- The graze-tolerance model: neither yields *cleanly* — the overlap was just left in place (identified as wrong, but its intended replacement — the dragged Node yields instead — was only ever applied to the graze case).
- The boundary-conflict case (failure mode 6): the existing sibling *can't* yield without violating a boundary, so ideally the dragged Node should yield instead — but nothing in the current architecture treats "who yields" as a decision made *before* committing to a push; it's discovered mid-push, after the wrong entity has often already been picked as "the one to move."

Open question: should "who yields" be resolved as a single up-front decision per conflict (e.g., an anchored/boundary-pinned Node always outranks a freely-movable one, which always outranks the currently-dragged Node) — a priority order — rather than an emergent property of whichever function happens to be running when the conflict is discovered?

**§10 answers this directly.** Dynamic (the actively dragged/dropped block) has priority (§10.1); Static yields via push in Tier 2, *unless* the push is boundary-blocked, in which case the interaction falls back to Tier 3 and Dynamic yields instead via auto-snap (§10.2's Boundary Obstruction rule). This is precisely the up-front priority order this tension asked for, and — independently — matches the mechanism the reverted round-6 fix used for failure mode 6 (abort the push rather than fling Static across the boundary). One case §10 doesn't cover: what happens when *Dynamic itself* can't yield cleanly either (its own auto-snap search would need to cross a boundary too)? New open item, 5.6(2).

**Resolved, §11.2.**

### 5.3 How far does a cascade reach?

Today, `computePushDisplacements`'s cascade is capped at `MAX_PUSH_CASCADE_DEPTH` (50) *siblings*, all within one parent. It has never been asked to reach *up* a level (a pushed child causing its own parent Frame to grow) or *down* (a pushed Frame's own children needing to shift because the push moved their container). Failure mode 7 is exactly a cascade that needed to reach up a level and didn't. Open question: is an *unbounded, whole-subtree* cascade (a single conflict can, in principle, ripple through every ancestor and every sibling at every level) the right model, or should cascades be deliberately scoped (e.g., "a push never crosses a Frame boundary; growth is handled by a completely separate pass") — and if scoped, how do we guarantee the scoped passes still compose into a system with no invariant violations at the seams (which is exactly how failure mode 7 was born)?

**§10 answers part of this.** §10.3's Expansion Collision Cascade confirms growth *does* need to reach outward to a Frame's own siblings — closing failure mode 7's specific gap — via the same push mechanism as Tier 2 (the expanding edge acts as an active collider). What it doesn't define is a *fallback*: Tier 2's push has an explicit Boundary Obstruction escape hatch (fall back to Tier 3); the phrase "recursively propagating if space allows" has no stated equivalent for when space does *not* allow. New open item, 5.6(3).

**Resolved, §11.2** — the same mechanism answers both 5.6(2) and 5.6(3): "space doesn't allow" is resolved by growing the blocking Frame, not by a separate fallback.

### 5.4 Simulate-then-commit, or discover-and-patch?

Nothing today computes the *full* consequence of a candidate placement before committing to it — `computeDragPreviewSize` gets partway there (one level of projection) for the *preview* only, and even that projection is discarded and recomputed independently by the real drop. Open question: should there be one single "given this candidate change, compute the complete resulting Layout for every affected Node, or determine the change is infeasible" function — used identically for the live preview and the real commit — rather than the current split where the preview approximates and the commit re-derives separately? If two Frames can't both satisfy their invariants (e.g., mutual boundary anchoring, see failure mode 6), does the operation get *adjusted* (dragged Node relocates) or *rejected outright* (drop refused, item snaps back)?

**§10 doesn't resolve this** — still fully open. §10.2's Boundary Obstruction language ("the push aborts, and the interaction falls back") reads as a discover-and-patch sequence (try the push, discover it's infeasible, retry differently) rather than a simulate-first-then-commit one, but doesn't say so explicitly either way — worth pinning down in the grill session, since I6/I7 (termination, preview/commit parity) are both easier to guarantee under simulate-then-commit.

**Resolved, §11.3.**

### 5.5 Termination and performance

An unbounded cross-level cascade (§5.3) needs a termination guarantee that isn't just "cap it at some depth and accept a wrong-but-stable answer" (which is what `MAX_PUSH_CASCADE_DEPTH` already does today, and which produces visibly-overlapping Nodes once the cap is hit). Open question: what's the actual worst-case shape of a cascade in this domain (how deep can Frame nesting realistically get; how many siblings can realistically share one parent), and is a full relaxation pass cheap enough to run on every `handleDragOver` tick (many times per second, during live pointer movement) or does it need to be restricted to `handleDragEnd` (commit time) with a cheaper approximation for the live preview?

**§10 raises the stakes here rather than resolving it.** The Expansion Collision Cascade (§10.3) is explicitly recursive across siblings *and*, implicitly, across ancestor levels (a pushed sibling that's itself a Frame may need to grow, which may need to push again) — meaning the worst-case cascade shape this tension worries about is now a confirmed *feature* of the design, not a hypothetical.

**Partially resolved, §11.5.** Termination itself is now easy to guarantee (see §11.5) — every step either pushes within existing bounds (already capped) or grows (monotonic, can't oscillate). The remaining genuinely open half is pure performance: is running the full resolve pass affordable on every `handleDragOver` tick? That's an empirical question for implementation-time profiling, not something this RFC can settle on paper.

### 5.6 Open items raised by the Author's Vision (§10)

New questions the vision itself introduces, not present in 5.1-5.5 before it. **All four resolved in the grill session — see §11.**

1. **Exact tier boundaries.** §10.2 names three tiers but doesn't give numeric/geometric definitions for "meaningful overlap" (Tier 2's trigger) versus "shallow penetration" (Tier 3's trigger). Per 5.1, this is exactly where the six ADR-0007 rounds struggled — does the boundary need to be kind-aware (different for Frame-vs-Frame than Card-vs-Card), and if so, on what basis? **Resolved, §11.1.**
2. **When Dynamic also can't yield.** Tier 3's fallback assumes the dynamic block can always find a valid auto-snap slot. What resolves a conflict where it can't either (its own nearest clear slot would itself cross a `minPosition` boundary — e.g., two Frames each anchored at opposite boundaries of the same parent, see §8 scenario 3)? Rejected outright (drop refused, item snaps back), or is there an implicit Tier 4? **Resolved, §11.2.**
3. **When the Expansion Collision Cascade can't fully resolve.** If a Frame's growth needs to push a sibling that is itself boundary-blocked, does the whole cascade abort (and if so, does the triggering Frame's growth get capped or clipped — which would violate I3, containment)? Does it recurse one level further up (push the blocked sibling's *own* parent)? §10.3 doesn't say. **Resolved, §11.2** (same mechanism as item 2).
4. **The "Block" / `CONTEXT.md` naming conflict** (flagged in §10's editorial note above) — needs an explicit decision before any of this reaches `src/`. **Resolved, §11.4.**

## 6. Invariants any design must satisfy

Framed as falsifiable statements — the grill session should try to break each one against a concrete scenario, not just accept them.

- **I1 — No overlap.** After any operation completes (a drop, a push, a growth), no two Nodes sharing a parent (or sharing the Canvas root) have overlapping rendered rects.
- **I2 — Full gutter, not just non-overlap.** After any operation completes, every pair of sibling Nodes is either fully outside each other's `FRAME_PADDING`-inflated rect, or one is a strict ancestor/descendant of the other (containment, not siblinghood). No resting state has a partial (0 < gap < `FRAME_PADDING`) gap.
- **I3 — Containment.** Every Frame's rendered box fully encloses every child's rendered box plus `FRAME_PADDING` on every side, at all times after an operation completes — this one already holds today (`computeContentSize`) and must keep holding.
- **I4 — Growth is a collision.** A Frame's rendered box changing size (I3) must never cause it to violate I1/I2 against its own siblings. If growth would violate them, something must give — a sibling moves, or growth is somehow bounded — but the violation must not be allowed to render even momentarily as a committed state. *§10 alignment:* §10.3's Expansion Collision Cascade is the concrete mechanism now proposed to satisfy this — a Frame's expanding right/bottom edge acts as an active collider exactly like a dropped block's edge does in Tier 2 (§10.2), pushing adjacent siblings to restore the gutter. **Resolved, §11.2** — growth-triggered pushes use the same universal grow-to-make-room fallback as everything else, so I4 never trades off against I3/I5.
- **I5 — Boundary respect.** No Node's Layout may ever be placed such that its rendered box crosses its parent's `minPosition` floor (or the Canvas's `{0,0}` origin at the root) — not as a rare edge case, but as an absolute floor no relaxation pass is allowed to violate to satisfy I1/I2/I4 elsewhere. *§10 alignment:* §10.2's Boundary Obstruction rule is exactly what gives this invariant teeth for Tier 2 — a blocked push aborts and falls back to Tier 3 rather than ever redirecting the static block across the boundary (the fix for failure mode 6). **Resolved, §11.2** — Tier 3's own fallback and the growth cascade both resolve through growth rather than ever crossing `minPosition`, so I5 holds unconditionally.
- **I6 — Termination.** Every operation resolves in a bounded, predictable number of steps — a user gesture must never appear to hang, and a cascade must never be able to oscillate (push A, which un-pushes B, which re-pushes A, forever). *§10 alignment:* §10.3's "recursively propagating if space allows" is precisely the undefined edge this invariant cares about — it names the recursion but not its termination condition. **Resolved, §11.5** — every step is either a bounded push or a monotonic (one-directional, never-undone) growth, which rules out oscillation by construction.
- **I7 — Preview/commit parity.** Whatever the live ghost preview shows during a drag must be *exactly* what committing the drop produces — this already holds for the single-level case today (`resolveDropPlacement` is shared between `handleDragOver`/`handleDragEnd`) and must keep holding once the design covers growth and multi-level cascades too. *§10 alignment:* **Addressed by §11.3**'s simulate-then-commit shape — one pure resolve function serves both call sites, so this holds by construction rather than by two paths staying in sync through discipline.
- **I8 — Determinism.** The same starting Layout plus the same candidate operation always produces the same resulting Layout — no dependency on iteration order, timing, or which sibling happens to be checked first, unless that ordering is itself an explicit, documented tie-break rule (as `computePushDisplacements`'s "largest overlap area wins as primary target" already is). *§10 alignment:* the tiered model (§10.2) is deterministic *by construction* once its tier boundaries are exact numbers. **Resolved, §11.1** — the tier boundaries are now exact numbers (a fixed pixel threshold, kind-aware), not qualitative language.

## 7. Candidate directions (unevaluated — for the grill session to weigh, not a recommendation)

Listed so the session has starting points, not because any is presumed correct. **§11 resolves this in favor of B**: §10's Author's Vision (fully specifying who-yields and one-directional growth) plus the grill session's resolution (§11.1-§11.5, including a proven termination argument) together answer B's own open requirements below — B is no longer "unevaluated" as of §11, and A/C are recorded here for completeness but weren't pursued.

**A. Whole-subtree relaxation pass.** Treat every affected ancestor chain and sibling set as one constraint graph; after any candidate mutation, run a fixed-point pass that resolves I1/I2/I4 violations (via push and/or growth) repeatedly until stable or a proven-safe iteration bound is hit, honoring I5 (boundary) as a hard constraint that reroutes who-yields (§5.2) rather than ever being violated. Most general, least implemented, unclear performance/complexity bound (§5.5). *Not chosen — §11's design gets A's key property (I5 as a hard constraint that reroutes who-yields) without needing a general constraint-graph solver.*

**B. Simulate-then-commit, single-parent-at-a-time, explicitly propagated upward.** Keep the current one-parent-at-a-time push model, but make Frame growth *explicitly* trigger the same push-resolution function one level up, recursively, as part of one atomic "compute full consequence" pass before any state is written — turning today's implicit, un-checked growth into an explicit recursive call of the same machinery already used for direct drops. Smaller conceptual jump from today's code; needs a clear answer to §5.2 (who yields) at every level, and to prove I6 (termination) for the recursive case specifically. **Chosen — see §11** (§11.3 for simulate-then-commit, §11.1/§11.2 for who-yields at every level, §11.5 for termination).

**C. Structural layout instead of arbitrary free-form positioning.** Constrain a Frame's children to a packed arrangement (e.g., a row/shelf that wraps, or a simple grid) so that I1/I2 hold *by construction* and there's no "conflict" to resolve at all — push-displacement and free-form collision math mostly disappear, replaced by a much simpler reflow-on-change algorithm. Biggest departure from the product's current free-form-Canvas identity (explicitly a design goal since v0.3.0/ADR-0002); would need to be validated against whether "arbitrary AWS-diagram-style free placement" is actually a hard product requirement or an assumption nobody's re-checked recently.

## 8. Concrete scenarios for the grill session

Hand-verifiable, in the same style as this codebase's existing test-comment tradition (exact pixel math, not hand-waving) — bring these to the session rather than solving them here:

1. Two same-height sibling Frames side by side inside a VPC; the left one gains a child that pushes its own auto-expanded width into the right one. Does the right Frame get pushed right (cascading the VPC's own width, per I4), does the left Frame's growth get capped, or is this actually a `findFreePosition`-style "grow toward whichever side has room" decision? *Resolved, §11.2 — the right Frame gets pushed right, cascading; if that push is itself boundary-blocked, the VPC grows to make room rather than the cascade capping or aborting.*
2. Three levels of nesting (VPC → Subnet → EC2 pair). Dropping a third EC2 into the Subnet grows the Subnet, which must grow the VPC, which might need to push a sibling Subnet next to it. How many levels does one drop's atomic dispatch need to touch, and is that still one clean reducer action?
3. Two Frames, each anchored at an opposite boundary of the same parent (one flush left, one flush right), with a drop that would require pushing both toward each other to make room. Neither can yield without violating I5. What's the correct resolution — reject the drop, shrink/reflow, or is this actually impossible given I3's floor sizes and needs to be a documented "drop refused, not enough room" case? *Resolved, §11.2 — this scenario's premise turns out to be looser than it looks: "flush right" isn't a hard boundary the way `minPosition` (flush left/top) is, since the parent can always grow rightward. So only the left-anchored Frame is ever truly immovable; the right-anchored one, Dynamic, or both can always resolve by shifting right/growing. Neither Frame needs pushing "inward" at all — the parent simply grows to fit whichever one ends up yielding. Confirms §11.2's claim that a genuine deadlock doesn't arise geometrically in this design.*
4. A drop that satisfies `hasSignificantOverlap` against sibling A, whose resulting push then also satisfies it against previously-uninvolved sibling B (today's existing cascade case) — verify this still terminates and produces a full-gutter result under whatever new model replaces `computePushDisplacements`.
5. The live ghost preview during a slow, deliberate drag that crosses in and out of "this would require growth" territory several times before the pointer settles — does the preview stay stable/non-flickery (I7 doesn't just mean "correct at drop," it means "correct throughout"), and is recomputing the full relaxation pass on every `handleDragOver` tick actually affordable (§5.5)?

## 9. Non-goals (unchanged from the existing backlog)

Pan/zoom, minimap, manual Frame resize handles, full keyboard fine-grained repositioning, multi-select drag — all already deferred in `docs/03-BACKLOG.md` and untouched by this RFC. This document is scoped strictly to: given the current free-form single-Node-drag interaction model, guarantee conflict-free, boundary-respecting, terminating placement at every level of the tree.

**One exception, found during the doc-consistency grill (§12):** `docs/03-BACKLOG.md`'s two deferred "live preview of which sibling/slot" items (the auto-snap-era one and the push-era one) are resolved as a side effect of §11.3's simulate-then-commit design, not left untouched — see §12 for detail. Everything else in the backlog remains genuinely out of scope.

## 10. Author's Vision & Spatial Layout Specification

**Editorial note:** the following is the project author's own proposed model for §5/§6 to be measured against — input to the grill session, not a decision this RFC is making on its own. It answers several open items directly (see §5.2, §5.3, §6's I4/I5 below) and is quoted here verbatim. One terminology conflict is flagged rather than silently fixed: the spec's collective term **"Block"** (for Card+Frame together) is new vocabulary not yet in `CONTEXT.md` — which explicitly lists "block" under *Avoid* for **four** separate canonical terms (Service, Node, Frame, and Card) — and `tests/architecture/terminology.test.ts` bans the word outright anywhere in `src/`. This needs an explicit decision (adopt "Block" into `CONTEXT.md` as a new umbrella term, or rename before any of this reaches code) — see open item 5.6(4), resolved in §11.4, further detail in §12.1.

### 10.1 Universal Principles (Blocks: Cards & Frames)
- **Block Concept:** Rules apply uniformly to both leaf Cards and container Frames (collectively called **Blocks**). A block already resting on the canvas is **Static**; the block currently being dragged/dropped is **Dynamic**.
- **Strict Spacing Invariant:** The standard gutter (`FRAME_PADDING` / clearance) must always be preserved between adjacent sibling blocks. No flush edges (0px) or boundary bleeding.
- **Dynamic Priority:** The dynamic block has higher initial priority over static blocks during placement resolution.

### 10.2 Overlap Tiers & Placement Dynamics

Interactions are categorized into three distinct, non-overlapping geometric tiers:

#### Tier 1: Deep Overlap (Enclosure / Strong Intersection)
- **Trigger:** Dynamic block is fully or near-fully contained within a valid target Frame (e.g., center inside or meeting the nesting threshold).
- **Behavior:** **Nesting**. The dynamic block becomes a child of the container Frame. Sibling displacement does not apply.

#### Tier 2: Moderate Overlap (Intentional Displacement / Push)
- **Trigger:** Meaningful overlap indicating clear displacement intent, but not qualifying as containment/nesting.
- **Behavior:** **Static Block Yields (4-Way Push)**:
  - The static block is pushed in the direction directly **opposite** to the struck edge (e.g., dynamic block crosses the left boundary of a static block -> static block is pushed to the **Right (+X)**).
  - **Strict Parallel Displacement:** Motion occurs strictly along the collision axis. The block never slides or drifts perpendicular to the collision vector (no vertical slipping on horizontal push, and vice versa).
- **Boundary Obstruction:** If the static block cannot move because it reaches an unyielding boundary (or fixed container edge), the push aborts, and the interaction falls back to Tier 3 behavior (dynamic block yields).

#### Tier 3: Slight Overlap (Graze / Low Penetration)
- **Trigger:** Shallow boundary penetration or gutter breach.
- **Behavior:** **Dynamic Block Yields (Auto-Snap / Free Slot)**:
  - The static block remains completely stationary.
  - The dynamic block snaps safely to the adjacent slot along the struck direction (e.g., dynamic block slightly grazes the right side of a static block -> dynamic block snaps to the **Right (+X)** of the static block with standard spacing).
  - Resolves strictly parallel to the interaction edge without vertical or horizontal drift.

### 10.3 Container Frame Specific Rules
- **Directional Growth (Right & Down):** Container Frames expand strictly toward **Right (+X)** and **Down (+Y)** to accommodate children. The top-left origin stays anchored.
- **Expansion Collision Cascade:** When a Frame auto-expands:
  - Its expanding right or bottom edge acts as an active collider.
  - Adjacent sibling Frames are pushed along the expansion vector to maintain the required gutter spacing, recursively propagating if space allows.

## 11. Resolved Design (Grill Session Outcome)

The following resolves every item in §5.6, plus §5.4 and half of §5.5, arrived at in a dedicated grill session working through the Author's Vision (§10) against §5's tensions and §6's invariants one at a time. Written as the concrete design v0.4.0 should implement — this is no longer "unevaluated," unlike §7.

### 11.1 Tier boundary: kind-aware, not one formula (resolves 5.6(1), 5.1, I8)

Tier 1 (nesting) is unchanged — `meetsNestingThreshold`'s existing center-inside-or-≥50%-of-dragged-area test already works and stays exactly as-is (§3.3 already flagged this as solid; nothing here revisits it).

For anything that fails Tier 1, the Tier 2/Tier 3 split is **kind-aware by construction**, not by a single formula special-cased after the fact — this is the direct lesson of all six ADR-0007 rounds, every one of which broke by trying to make one percentage-or-pixel formula work for both Card and Frame pairs simultaneously:

- **Frame-vs-Frame: no Tier 3 exists.** Any real overlap between two Frame-sized rects that isn't Tier-1 nesting is unconditionally Tier 2. There is no threshold to calibrate — two Frames are user-authored structural boxes (a VPC, a Subnet), and a phantom, cosmetic overlap between them is never an acceptable resting state regardless of how small it is relative to their area or which axis it's shallow on (this is exactly ADR-0007 round 4's `isFrameSized`/`violatesGutter` finding, now promoted from "one branch of a shared formula" to "the whole rule for this kind pairing").
- **Card-involved pairs: a flat penetration-depth threshold.** Tier 3 iff penetration on the shallower axis is below `MIN_PUSH_PENETRATION` (`FRAME_PADDING * 2` = 32px); Tier 2 otherwise. No area-ratio math at all — that was the specific mechanism that kept misjudging elongated overlaps (failure mode 3). Since Frame-vs-Frame is handled separately above, this formula never needs to account for a Frame's aspect ratio again — it only ever compares a Card-sized participant's own small, fixed dimensions.

This directly satisfies I8 (determinism): both branches are exact, closed-form geometric tests with no qualitative language left in them.

### 11.2 Universal fallback: grow, don't reject or redirect (resolves 5.6(2), 5.6(3), I4, I5)

One mechanism answers both "Dynamic can't yield" (5.6(2)) and "the Expansion Collision Cascade can't fully resolve" (5.6(3)), because they're the same underlying situation: **a resolution step needs more space than currently exists.**

Neither a Frame nor the Canvas root has an *upper* size bound anywhere in this system — `computeContentSize` and `computeRootContentSize` already grow without limit, and the Canvas is scrollable rather than viewport-capped. Only the *lower* bound (`minPosition`) is ever hard. So whenever any step — a Tier 2 push, a Tier 3 auto-snap search, or an Expansion Collision Cascade push — would need to cross `minPosition` to succeed, the resolution is: **grow the relevant Frame (right/down, per §10.3's Directional Growth) to create the missing space, then retry the step.** This applies uniformly:

- Tier 2's Boundary Obstruction (§10.2) no longer fails over to "abort the push" as a dead end — it retries after growing the parent enough to give the static block room to move.
- Tier 3's auto-snap (§10.2) that finds no clear slot retries after the same growth, rather than rejecting the drop.
- The Expansion Collision Cascade (§10.3) that hits a boundary-blocked sibling grows *that sibling's own parent* in turn, recursing outward exactly the way a Tier 2 push cascades between siblings today.

**"Reject the drop" is not implemented as a real code path.** Given growth is unconditionally available and unbounded, a case where even growth can't create room doesn't arise geometrically in this design — it would only ever be reachable via a bug, not a legitimate layout. (A future domain-level constraint — e.g., a hard cap on canvas size — would change this and reopen the question; nothing like that exists today.)

This makes I4 and I5 hold unconditionally: growth is never allowed to leave a violated I1/I2 uncorrected (I4), and no step ever crosses `minPosition` to resolve a conflict, because crossing it is never the chosen strategy — growing away from it always is (I5).

**Follow-up grill session (round 2) settled two more details of this mechanism:**

- **Growth cascade direction is fixed to the expanding edge, never omnidirectional.** A regular Tier 2 push (§11.1) is direction-based on which side Dynamic approached from — but a growth-triggered cascade is not: a right-expansion always pushes affected siblings right, a bottom-expansion always pushes down, never the reverse. This isn't a separate rule bolted on; it's required by the termination argument (§11.5) — an omnidirectional growth-cascade could in principle push a sibling back toward `minPosition`, which would reopen exactly the boundary problem this whole mechanism exists to close.
- **Growth applies the same kind-aware tier rule to whatever it collides with, Card or Frame — not a growth-specific rule.** A growing Frame's edge acts exactly like a dropped block's edge for classification purposes (§11.1): colliding with a sibling Frame is unconditionally Tier 2 (pushed); colliding with a sibling Card is classified by the same flat 32px penetration threshold, so a Card can either get pushed (Tier 2) or nudge itself out of the way via auto-snap (Tier 3) depending on how deep the collision is. One tier rule serves both direct drops and growth — §10.3's original wording ("adjacent sibling *Frames* are pushed") is narrower than the actual design and is superseded by this.

### 11.3 Simulate-then-commit (resolves 5.4, I7)

The engine is one pure function — call it `resolveLayout(tree, layout, candidate)` for concreteness, though naming is an implementation decision, not an RFC one — that takes the current full Layout state and a candidate placement (a Node, a target parent, a position) and returns the **complete** resulting Layout for every affected Node: the candidate's own landing position, every pushed sibling at every affected level, and every Frame whose size changes as a consequence, walked recursively until stable. No partial state is ever written mid-resolution, and no caller inspects intermediate steps.

`handleDragOver` (live preview) and `handleDragEnd` (real commit) call this exact function. This is what makes I7 (preview/commit parity) hold *by construction* rather than by two independently-written approximations happening to agree — which is exactly how failure mode 7 (Frame growth colliding with a sibling) slipped through undetected: the old preview projection and the old commit path were two different, incompletely-overlapping pieces of logic.

Mechanically, this supersedes `computeDragPreviewSize`'s one-level approximation (§3.1) — the preview simply renders `resolveLayout`'s own output rather than doing its own separate, shallower projection. The reducer's existing `displacedPositions: Record<NodeId, Layout>` field (§3.2 step 4) needs no shape change — `resolveLayout`'s full result populates it with every affected Node across every level, not just one parent's direct children; it remains one atomic dispatch.

**Follow-up grill session (round 2) settled the algorithm's exact shape and a third caller:**

- **Strictly bottom-up, one pass per level, never revisited.** `resolveLayout` resolves the immediate parent's siblings first, then checks whether that parent itself must grow, then — only if so — recurses one level further up to the grandparent, and so on. A lower level, once resolved, is never revisited as a consequence of something discovered higher up. This is what §11.5's termination proof actually relies on (every step is forward progress, nothing is undone), so it's the required shape, not just a convenient one.
- **Tier 1 (nesting/parentage) is decided once, before `resolveLayout` runs at all, using the drop's pre-resolution geometry — never re-evaluated mid-resolution.** This is unchanged from today's architecture (§3.3 already flagged `deepestDroppableFirst`/`meetsNestingThreshold`'s parentage decision as a separate, solid concern) and stays true even though growth is now a much bigger part of the picture: growth can only change Frame *sizes* after parentage for this gesture is already fixed. A Frame growing during resolution never causes a drop to retroactively "should have" nested somewhere else.
- **`KeyboardPlacement.tsx` becomes a third caller of `resolveLayout`, not a second parallel algorithm.** Keyboard placement's problem — a Node needs a position inside an already-chosen parent (chosen via the dropdown, not inferred from geometry), with no incoming Dynamic-vs-Static conflict — is a degenerate case of the same problem `resolveLayout` already solves: it's always the Tier-3-style "find clear space, growing if none exists" path, with no Tier 1/Tier 2 decision to make (parentage is pre-chosen, and there's no existing overlap to negotiate). `findFreePosition`'s ring-search (§3.1, §3.3) doesn't disappear — it becomes the internal auto-snap search `resolveLayout` itself uses for the Tier 3 case — but keyboard placement stops being an independently-maintained algorithm that has to separately prove I1/I2/I5/I6 hold. This also closes a real, previously-unnoticed gap: today's `findFreePosition` has a documented last-resort fallback that silently accepts an imperfect (possibly overlapping) position when its ring search is exhausted — contradicting I1/I2 as worded ("after any operation completes," no carve-out for keyboard placement). Routing keyboard placement through `resolveLayout` gives it the same universal growth fallback (above) instead of that silent give-up. **This explicitly supersedes ADR-0005's own stated position** ("`KeyboardPlacement.tsx` still uses [`findFreePosition`], since keyboard assignment has no drop-position/directional intent to push *from*. This is a deliberate scope boundary, not an oversight.") — noted here rather than silently drifted past; see §12.2 for the doc-update this implies.

### 11.4 "Block" adopted into the domain vocabulary (resolves 5.6(4))

`CONTEXT.md` gains a **Block** entry: *the collective term for a Card or a Frame together — whichever a Node is currently rendered as. Used when a rule applies to both uniformly (e.g., spacing, collision) rather than to one specifically.* The existing "Avoid: block" notes under Service, Node, Frame, **and Card** (four entries, not three — corrected from an earlier miscount in §10's editorial note) are replaced by a pointer to this new, precise definition, rather than four blanket warnings against a word that turns out to have a real, needed meaning here.

**A caution worth stating plainly, found during the doc-consistency grill (§12.1):** `tests/architecture/terminology.test.ts`'s own comment explains the *original* reason "block" was banned — it was used ambiguously for **either** Service (the catalog type) **or** Node (a placed instance), and that ambiguity is exactly the kind of drift the test exists to catch. The newly-proposed "Block" sense (a Card/Frame *render-kind* grouping) is a **third**, different meaning — not a return to either of the two banned ones. The `CONTEXT.md` entry and the terminology test's error message both need to make this distinction unmistakable (Block = "which of Card/Frame a Node renders as," never a stand-in for Service or Node themselves), or this reintroduces the exact category of confusion the original ban was written to prevent.

`tests/architecture/terminology.test.ts`'s current banned-word check needs to change from "reject `/\bblocks?\b/i` anywhere in `src/`" to something that still catches the *casual* synonym usage the rule was originally protecting against (using "block" loosely for Node/Frame/Card individually) while allowing this new, specific, glossary-defined collective sense. The exact mechanism (e.g., only permit the capitalized `Block`/`Blocks` as a whole-word identifier, or scope the exception to specific files) is an implementation-time detail for whoever writes the v0.4.0 code, not something this RFC needs to pin down further.

### 11.5 Termination (resolves 5.5's termination half)

Every resolution step is one of exactly two kinds: a **push**, bounded by the existing `MAX_PUSH_CASCADE_DEPTH` precedent (a finite cap on how many siblings one conflict can ripple through at a single level), or a **growth**, which is strictly monotonic — a Frame's size only ever increases, never decreases, and `computeContentSize`'s derivation guarantees a growth is never later "undone" by a subsequent step. Because growth never reverses, the oscillation failure mode I6 worries about (push A, which un-pushes B, which re-pushes A, forever) has no mechanism available to occur: nothing in this design ever moves a Node or shrinks a Frame as a *reaction* to a previous step, only pushes (bounded) or grows (monotonic, and bounded in practice by the tree's actual finite depth and sibling counts). This resolves I6 outright — no additional termination mechanism (an iteration cap, a "give up and accept the wrong answer" fallback) needs inventing.

**Follow-up grill session (round 2): a matching defensive cap, `MAX_GROWTH_CASCADE_DEPTH = 4`.** "Naturally bounded by the tree's finite depth" is a proof, not a runtime guard — this codebase already has a precedent (`MAX_PUSH_CASCADE_DEPTH`) for capping something proven-bounded-in-practice anyway, as defense-in-depth against a future change invalidating the proof. Checked against the actual domain data (`challenge-01.ts`, `challenge-02.ts`): today's deepest real nesting is 2 levels of Frame (VPC → Subnet, or VPC → ECS Cluster) before a leaf Card — `4` leaves comfortable headroom, including for a Card dynamically promoted to a Frame mid-session (FR-002) nesting one level deeper than the catalog's static definitions suggest. Like `MAX_PUSH_CASCADE_DEPTH`, this cap should never actually bind in practice; it exists purely so a future bug can't turn a proven-terminating recursion into an actually-unbounded one.

**What remains genuinely open** (the other half of §5.5, not resolved here): whether running the *complete* `resolveLayout` pass is cheap enough to call on every `handleDragOver` tick during a live drag, or whether the live preview needs a cheaper approximation while the exact pass is reserved for `handleDragEnd`. This is an empirical performance question that depends on real tree sizes and cascade depths in practice — worth a profiling spike during implementation, not something this RFC can settle on paper. If it does turn out too expensive, the fallback (a debounced or depth-limited preview that still calls the same exact function at `handleDragEnd`) would still preserve I7 for the case that matters most (what actually gets committed), at the cost of the live preview lagging slightly during a fast drag.

## 12. Touchpoints & Existing-Doc Impact Map

A grill-with-docs pass through `CONTEXT.md`, `docs/02-PLAN.md`, every existing ADR, `docs/03-BACKLOG.md`, and `tests/architecture/terminology.test.ts` before moving to `/speckit-specify`, cross-checking §11's resolved design against what's already committed. Two real gaps were found in this RFC's own text and fixed in place (§10, §11.4); the rest is a checklist of what the eventual v0.4.0 implementation needs to update in each existing artifact, and confirmation of what stays untouched.

### 12.1 `CONTEXT.md` and `tests/architecture/terminology.test.ts`

- **Fix applied:** §10 and §11.4 both said "block" is avoided for three canonical terms; it's actually **four** — Service, Node, Frame, and Card all list it. Corrected in place.
- **New finding:** the terminology test's own comment states the *original* reason for banning "block" — ambiguity between Service (catalog type) and Node (placed instance). The RFC's proposed "Block" (a Card/Frame render-kind grouping) is a **third, different** sense, not a return to either banned one. When `CONTEXT.md` gains the Block entry (§11.4), its wording — and the terminology test's error message, which currently only mentions "Service (catalog) or Node (placed)" as the correction — both need to make this distinction explicit, or the fix reintroduces the same category of drift the ban exists to prevent.
- **Action for implementation time (not this RFC):** add the `CONTEXT.md` Block entry exactly as drafted in §11.4; update the four "Avoid: block" notes to point at it; change `terminology.test.ts`'s `FORBIDDEN` pattern for `/\bblocks?\b/i` so it still catches casual/individual misuse but allows the new glossary-defined collective sense (mechanism left open per §11.4, e.g. scoping the exception to the exact capitalized identifier `Block`/`Blocks`).

### 12.2 ADR status

- **ADR-0005 (directional push displacement)** — two of its decisions are directly superseded by this RFC: (a) "directional push replaces `findFreePosition` entirely for drag-and-drop" is superseded by §11.1/§11.2's tiered model, which reintroduces auto-snap (Tier 3) and growth-driven resolution into drag-and-drop; (b) its explicit "deliberate scope boundary" keeping `KeyboardPlacement.tsx` on a separate algorithm is superseded by §11.3's unification. **Action for implementation time:** mark ADR-0005 `Status: Superseded by [the v0.4.0 implementation ADR, once written]`, pointing back to this RFC.
- **ADR-0006 (nesting threshold only gates deeper-vs-shallower Frame pairs)** — **confirmed compatible, not superseded.** §11.3 explicitly keeps Tier 1/parentage resolution ("decided once, upfront, using pre-resolution geometry") as today's `collision.ts` already does it; ADR-0006's candidate-walk logic is untouched by this RFC. No status change needed.
- **ADR-0007 (push requires significant overlap)** — its currently-committed decision (`hasSignificantOverlap`'s percentage-of-area trigger, always-positive push direction) is wholesale replaced by §11.1 (kind-aware tier boundary) and §11.2 (omnidirectional, growth-driven resolution). This isn't a surprise — ADR-0007's own committed text already documents the two rounds that got it there, and the six further rounds that motivated this RFC are preserved in `git stash` rather than merged. **Action for implementation time:** mark ADR-0007 `Status: Superseded by [the v0.4.0 implementation ADR]`, same as ADR-0005.
- **ADR-0002/0003/0004 (2D canvas, auto-snap origins, grid/gutter constants)** — untouched. `FRAME_PADDING`, the grid-snap model, and Frame/Card rendering fundamentals are all inherited as-is (§3.3 already says so); this RFC only changes *how conflicts between Nodes get resolved*, not the underlying spatial model those ADRs established.

### 12.3 `docs/02-PLAN.md`

Already up to date as of the v0.3.7 wrap-up: the "Baseline audit" note under v0.3.7 and the `v0.4.0 (Spatial Layout Engine Redesign)` roadmap entry already point at this RFC. No further edit needed until `/speckit-specify` produces a spec to link from that entry.

### 12.4 `docs/03-BACKLOG.md`

Two existing deferred items are resolved as a side effect of §11.3's simulate-then-commit design, not left untouched as §9 originally implied (corrected there too): "live preview of which sibling gets pushed, and to where" and its auto-snap-era predecessor. Once the live preview renders `resolveLayout`'s actual output rather than a separate one-level projection, both items are satisfied by construction — **action for implementation time:** close both backlog entries when v0.4.0 ships, referencing this RFC.

### 12.5 Naming/reference discrepancy flagged, not resolved

The request that prompted this audit referenced `docs/01-PRD.md`; no such file exists in this repo. The closest-named artifact is `docs/01-RESEARCH.md` (product/market positioning and audience research, compiled 2026-08-29) — read and confirmed unrelated to Canvas collision/placement mechanics, so nothing in it conflicts with this RFC. Flagging the mismatch rather than silently assuming which file was intended.

### 12.6 State/reducer contract

**Confirmed compatible, no schema change.** `displacedPositions: Record<NodeId, Layout>` on `ADD_NODE`/`MOVE_NODE` (introduced by ADR-0005) already has the right shape for §11.3's full multi-level result — it just gets populated more broadly (every affected Node across every level, not one parent's direct children). `Layout`'s own shape (`{x, y}`) is unchanged; sizes remain derived-only (never persisted), so `SESSION_VERSION`/persistence needs no bump for this RFC specifically.
