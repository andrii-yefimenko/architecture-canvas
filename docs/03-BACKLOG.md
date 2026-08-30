# Backlog — Post-MVP & Out of Scope

Ideas deliberately deferred, kept so they aren't lost. Nothing here is rejected on merit unless noted; most are simply larger than the MVP should carry.

See `docs/02-PRODUCT-UX.md` for what was decided instead, and `MVP.md` for the MVP boundary.

## Deferred during the UX review (2026-08-29)

**Penalize duplicate / redundant services.**
Currently rules are existential — extra VPCs or frontends are ignored. Docking points for redundancy would teach real architectural discipline, but requires evaluation rules beyond the 11 specified in `MVP.md`.

**Generic service blocks with configure-on-drop role assignment.**
Instead of fixed "EC2 (Frontend)" / "EC2 (Backend)" catalog items, drop a generic EC2 and assign its role afterward. Scales far better as the catalog grows, but needs a real node-configuration UI.

**Tolerate any-descendant nesting rather than strict direct-child matching.**
Would let a correct-in-spirit architecture pass even with an extra wrapper layer. Only becomes relevant once the catalog includes legitimate intermediate containers (security groups, auto-scaling groups, etc.).

**Finer-grained requirement reveal.**
One button per individual bullet, or a single "ask the client a question" button that reveals the next hidden item on each click. Closer to a real client interview than the current four category buttons.

**Canvas snapshot at submit time, as a checkpoint.**
Save the exact tree that produced each score so the user can compare attempts or roll back to a previous one. Pairs naturally with score history below.

**Undo/redo for canvas operations.**
Would also soften the cascade-delete confirmation prompt, which currently exists only because there's no undo.

**Score history across attempts.**
Show progression over multiple submissions rather than only the latest result.

**Unified scoring logic across challenges.**
The current formula (100 / rule count) makes scores incomparable between challenges, because rule granularity varies. In Challenge #1, three "must be present" rules are strictly implied by their placement rules (7→6, 10→9, 11→8), so correctly placing the frontend is worth 18.2 points while correctly placing the Internet Gateway is worth 9.1. A future scheme should normalize weighting — by rule category, by architectural significance, or by deduplicating implied rules — so a 75 on one challenge means roughly what a 75 means on another. Accepted as-is for the MVP, where there is only one challenge and nothing to compare against.

## Already out of scope per `MVP.md`

Restated here for one consolidated view of everything not in the MVP.

- **AI assistant / AI chat** simulating the client conversation behind hidden requirements — the core of the future-product vision in `PROJECT.md`.
- **AI-driven architecture review** with best-practice suggestions and explanations of *why* a decision is wrong.
- **Dynamic challenge generation.**
- **Multiple challenges** (MVP ships Challenge #1 only).
- **Multiple cloud providers** (MVP is AWS-only).
- **Advanced architecture validation** beyond hardcoded parent-child rules.

## From `docs/01-RESEARCH.md`

**Freemium paid tier** — gating the full challenge library and AI features behind a subscription. Deferred until the AI layer exists and the challenge library is large enough (~5–10 challenges) to be worth paying for; that same milestone is the trigger for widening distribution beyond build-in-public.
