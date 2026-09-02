# Feature Specification: Multi-Challenge Catalog & Challenge #2

**Feature Branch**: `feat/02-challenge-2-and-menu`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Add a Catalog Page listing every Challenge in a new Challenge Registry, add Challenge #2 (Containerized Microservice, ECS Fargate), and isolate each Challenge's in-progress session so work never leaks between Challenges." No explicit command arguments were provided when `/speckit-specify` was invoked; this description is derived from the doc-alignment session earlier in this conversation (a `grill-with-docs` audit followed by brainstorming resolutions, 2026-09-01–02), which the user explicitly greenlit for SpecKit.

**Ground truth**: `PROJECT.md`, `MVP.md`, `CONTEXT.md`, `docs/03-BACKLOG.md`, `docs/04-TECH-STACK.md`, `docs/pages-ux/01-TASK-PAGE.md`, `docs/pages-ux/02-CATALOG-PAGE.md`, `docs/challenges/00-TEMPLATE.md`, `docs/challenges/01-SIMPLE-WEB-APPLICATION.md`, `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`, and `specs/001-architecture-canvas-mvp/` (the shipped single-Challenge MVP this feature extends).

**Terminology**: This specification uses the canonical vocabulary defined in `CONTEXT.md` — **Challenge**, **Challenge ID**, **Challenge Registry**, **Catalog Page**, **Task Page**, **Difficulty**, **Tags**, plus the existing **Service**, **Node**, **Canvas Tree**, **Rule**, **Evaluation**, **Recommendation**, **Score**, **Hidden Requirement Category**. These are domain terms, not implementation names.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and Launch a Challenge from the Catalog (Priority: P1)

A user opens the platform and, instead of landing directly inside one fixed Challenge, sees a Catalog Page listing every available Challenge as a card — title, difficulty, short description, tags — and picks one to start.

**Why this priority**: This is the entry point the entire multi-Challenge model depends on. Without it there is no way to reach more than one Challenge, and the product reverts to the single-Challenge MVP it's meant to move past.

**Independent Test**: Load the root URL, confirm at least two Challenge cards render in Registry order, activate Start Challenge on a card, and confirm the corresponding Task Page loads with that Challenge's own title, requirements, and Service catalog.

**Acceptance Scenarios**:

1. **Given** the application has just loaded, **When** the user navigates to the root URL, **Then** the Catalog Page displays one card per Challenge in the Challenge Registry, in Registry order.
2. **Given** the Catalog Page is displayed, **When** the user inspects a card, **Then** its title, Difficulty, short description, and Tags are shown alongside a Start Challenge control.
3. **Given** the Catalog Page is displayed, **When** the user activates a card's Start Challenge control, **Then** the corresponding Challenge's Task Page loads, addressed by that Challenge's Challenge ID.
4. **Given** a Task Page is displayed, **When** the user activates the header's Back to Catalog control, **Then** the Catalog Page is displayed again.
5. **Given** the user navigates directly to a URL naming an unknown or missing Challenge ID, **When** the page loads, **Then** the Catalog Page is displayed instead of an error.

---

### User Story 2 - Complete Challenge #2 (Containerized Microservice) End to End (Priority: P1)

A user selects the new Containerized Microservice Challenge from the Catalog and works it exactly as they would Challenge #1 — reading its Visible Requirements, revealing its Hidden Requirement Categories, placing Services (Application Load Balancer, ECS Cluster, Fargate Task, RDS, and supporting networking) on the Canvas, and submitting for evaluation against that Challenge's own Rules.

**Why this priority**: A Catalog with only one real Challenge behind it doesn't deliver the value the Catalog Page promises. A second, fully independent Challenge is what makes "multi-Challenge" real rather than decorative.

**Independent Test**: From the Catalog, start Challenge #2, reveal all its Hidden Requirement Categories, build a Canvas Tree matching its expected architecture, submit, and confirm a Score of 100 with every one of its Rules passed.

**Acceptance Scenarios**:

1. **Given** Challenge #2's Task Page has just loaded, **When** the user reads the Requirements panel, **Then** Challenge #2's own title, description, and Visible Requirements are shown — not Challenge #1's.
2. **Given** Challenge #2's Task Page is displayed, **When** the user inspects the Services panel, **Then** only Challenge #2's Service catalog is listed, grouped by category.
3. **Given** a Canvas Tree matching Challenge #2's expected architecture, **When** the user submits, **Then** the Score is 100 and every one of Challenge #2's Rules is reported as passed.
4. **Given** a Canvas Tree with the ECS Cluster placed outside a Private Subnet, **When** the user submits, **Then** that Rule is reported as failed with a Recommendation naming the correction.

---

### User Story 3 - Work Stays Isolated Between Challenges (Priority: P2)

A user builds part of a Canvas Tree on one Challenge, then visits a different Challenge — directly by URL or via the Catalog. The second Challenge's Canvas is empty and unaffected; the first Challenge's work is untouched and reappears if the user returns to it within the same browser tab.

**Why this priority**: Without isolation, one Challenge's in-progress Canvas Tree could be silently accepted and displayed as another Challenge's session — Challenge #1 and Challenge #2 already share several Service ids (`vpc`, `rds`, `internet-gateway`, `nat-gateway`), so this is a real risk, not a hypothetical one. It's P2 because it only becomes observable once two Challenges exist (User Story 1 and User Story 2).

**Independent Test**: Start Challenge #1, place several Nodes, navigate directly to Challenge #2's Task Page, and confirm its Canvas is empty; separately, reload Challenge #1's Task Page and confirm its Nodes are restored.

**Acceptance Scenarios**:

1. **Given** a Canvas Tree has been built on Challenge #1, **When** the user navigates directly to Challenge #2's Task Page, **Then** Challenge #2's Canvas is empty, showing no Nodes from Challenge #1.
2. **Given** Nodes are placed on Challenge #1's Canvas, **When** the browser is reloaded while still on Challenge #1's Task Page, **Then** Challenge #1's Canvas Tree and revealed Categories are restored exactly as left.
3. **Given** Challenge #1 and Challenge #2 both define a Service with the same catalog id, **When** either Challenge's session is restored, **Then** only that Challenge's own persisted Canvas Tree is used — never the other Challenge's.

---

### User Story 4 - Leaving a Challenge Clears Its In-Progress Session (Priority: P3)

A user partway through a Challenge goes back to the Catalog. When they later start that same Challenge again, they begin from an empty Canvas — not the state they left behind.

**Why this priority**: This keeps persistence scoped to its stated purpose — surviving an accidental refresh — rather than growing into an implicit "resume later" feature that was explicitly ruled out. It's P3 because its absence is a minor inconsistency, not a broken workflow: the user could clear the Canvas by hand.

**Independent Test**: Build a partial Canvas Tree on a Challenge, return to the Catalog via the header control, start the same Challenge again, and confirm the Canvas is empty.

**Acceptance Scenarios**:

1. **Given** a partially built Canvas Tree on a Challenge, **When** the user activates the header's Back to Catalog control, **Then** that Challenge's persisted session is cleared.
2. **Given** a Challenge's session was cleared by leaving, **When** the user starts that same Challenge again from the Catalog, **Then** its Canvas is empty and no Hidden Requirement Categories are revealed, identical to a first visit.

---

### Edge Cases

- **Unknown or missing Challenge ID**: Navigating directly to a Task Page URL for an id not in the Challenge Registry displays the Catalog Page, not an error page.
- **Browser back/forward navigation**: Using the browser's native back and forward controls between the Catalog Page and a Task Page produces the same result as using the in-app Back to Catalog control and Start Challenge buttons.
- **Shared Service ids across Challenges**: Challenge #1 and Challenge #2 both use ids like `vpc` and `rds`; a persisted Canvas Tree for one Challenge is never accepted as valid for another, even when every Service id it references also happens to exist in the other Challenge's catalog.
- **Unavailable local storage**: If session storage can't be written, each Challenge's Task Page remains fully usable for the current visit; only persistence is silently forgone, matching existing MVP behavior (see `specs/001-architecture-canvas-mvp/spec.md` SC-009).
- **Registry order vs. display order**: The Catalog Page always lists Challenges in the order they're defined in the Challenge Registry, regardless of Difficulty or title.
- **Stored schema mismatch**: A stored session whose version doesn't match the current schema is discarded and that Challenge starts clean — per Challenge, the same behavior the single-Challenge MVP already applies to its one Challenge.

## Requirements *(mandatory)*

### Functional Requirements

**Challenge Registry & Catalog Page**

- **FR-001**: System MUST maintain a Challenge Registry containing every Challenge available in the app, in a fixed authorial order.
- **FR-002**: System MUST display a Catalog Page listing one card per Challenge in the Challenge Registry, in Registry order.
- **FR-003**: Each Catalog card MUST show that Challenge's title, Difficulty, short description, and Tags, plus a Start Challenge control.
- **FR-004**: Activating a card's Start Challenge control MUST navigate to that Challenge's Task Page, addressed by its Challenge ID.
- **FR-005**: Navigating to a Challenge ID not present in the Challenge Registry MUST display the Catalog Page rather than an error.

**Task Page routing & navigation**

- **FR-006**: Each Challenge's Task Page MUST be reachable at a URL that encodes its Challenge ID.
- **FR-007**: The Task Page header MUST include a Back to Catalog control that navigates to the Catalog Page.
- **FR-008**: Navigating between the Catalog Page and a Task Page, whether via in-app controls or the browser's native back/forward controls, MUST produce equivalent results.

**Challenge #2 content**

- **FR-009**: The Challenge Registry MUST include a second Challenge — a containerized microservice architecture (Application Load Balancer, ECS Cluster running Fargate, and a relational database) — independent in content from Challenge #1.
- **FR-010**: Challenge #2's Task Page MUST display only Challenge #2's own title, description, Visible Requirements, Hidden Requirement Categories, Service catalog, and Rules — never Challenge #1's.
- **FR-011**: Challenge #2 MUST be evaluated using the same Rule types, direct-child-only containment semantics, and existential matching already established for Challenge #1; this feature introduces no new Rule kind.

**Per-Challenge session isolation**

- **FR-012**: System MUST persist each Challenge's Canvas Tree and revealed Hidden Requirement Categories under a storage location scoped to that Challenge's Challenge ID, distinct from every other Challenge's.
- **FR-013**: Restoring a Challenge's persisted session MUST validate that the stored data belongs to that Challenge ID; stored data belonging to a different Challenge MUST NOT be used, even when every Service id it references also exists in the current Challenge's catalog.
- **FR-014**: Activating the Back to Catalog control MUST clear the current Challenge's persisted session.
- **FR-015**: Starting a Challenge whose persisted session was cleared, or that has never been visited, MUST begin from an empty Canvas Tree with no Hidden Requirement Categories revealed.
- **FR-016**: A browser reload that does not pass through the Back to Catalog control MUST restore the current Challenge's Canvas Tree and revealed Categories exactly as they were before the reload.

### Key Entities

- **Challenge Registry**: The ordered collection of every Challenge available in the app. Backs the Catalog Page; its order is authorial, not sorted or computed.
- **Challenge ID**: The stable identifier for a Challenge, used to address its Task Page and to scope its persisted session. Distinct from its title, which is display text.
- **Catalog Page**: The landing page listing every Challenge in the Challenge Registry as a card, each with a control to start it.
- **Challenge** *(extended)*: One complete exercise — title, description, Visible Requirements, Hidden Requirements, Service catalog, and Rules, per `specs/001-architecture-canvas-mvp/spec.md`. Now one of potentially several entries in the Challenge Registry rather than the application's single fixed exercise.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user reaches any Challenge in the Registry from the Catalog Page in two actions or fewer (load the Catalog, activate Start Challenge).
- **SC-002**: 100% of Catalog cards display a title, Difficulty, short description, Tags, and a working Start Challenge control.
- **SC-003**: A Canvas Tree matching Challenge #2's expected architecture scores exactly 100, with every one of its Rules reported as passed — matching the existing guarantee for Challenge #1 (`specs/001-architecture-canvas-mvp/spec.md` SC-002).
- **SC-004**: Building a Canvas Tree on one Challenge and then visiting a different Challenge never displays any Node originating from the first Challenge.
- **SC-005**: After leaving a Challenge via Back to Catalog and starting it again, 0% of the previously placed Nodes or revealed Categories reappear.
- **SC-006**: A browser reload that occurs without visiting the Catalog Page restores 100% of the current Challenge's placed Nodes and revealed Categories, matching the existing single-Challenge guarantee (`specs/001-architecture-canvas-mvp/spec.md` SC-005).

## Assumptions

**Scope**

- This feature adds exactly one additional Challenge (Challenge #2) plus the Catalog Page, Challenge Registry, and routing needed to reach it. It does not add search, filtering, sorting, per-Challenge completion badges, score history, or a third Challenge — all remain logged in `docs/03-BACKLOG.md`.
- `MVP.md` remains frozen as the v0.1.0 record of the single-Challenge release. This spec supersedes its "Multiple challenges" out-of-scope line without editing that document, per the resolution recorded in `docs/03-BACKLOG.md`.
- No absence / "must not exist" Rule kind is introduced. Challenge #2's catalog keeps EC2 (Frontend) and EC2 (Backend) as unscored distractors, consistent with Challenge #1's existing distractor Services.
- All Phase-1 MVP guarantees — evaluator semantics, drag-and-drop mechanics, three-panel layout, submit/resubmit behavior — continue to apply per Challenge and are not restated here; see `specs/001-architecture-canvas-mvp/spec.md`.

**Pre-decided technical constraints** *(settled in `docs/04-TECH-STACK.md`; recorded here as inputs, with elaboration belonging to `/speckit-plan`)*

- Routing is a small hand-rolled client-side router (no routing library) — the app has exactly two page shapes, Catalog Page and Task Page.
- Persistence remains browser local storage only, now with one versioned storage key per Challenge ID instead of one key for the whole application.
- Challenge #2's content is authored as a typed module bundled with the application, collected into the Challenge Registry alongside Challenge #1 — not fetched.

**Environment**

- Same environment assumptions as `specs/001-architecture-canvas-mvp/spec.md`: current desktop browser, JavaScript enabled, drag-and-drop support; local storage available in the common case, its absence degrading persistence only.

## Dependencies

- Depends on the existing Challenge #1 implementation and evaluator engine from `specs/001-architecture-canvas-mvp/`; this feature extends rather than replaces it.
- `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md` is the authoritative source for Challenge #2's content: its description, Visible and Hidden Requirements, Service catalog, expected architecture, and its 9 Rules with Recommendations.
- `docs/pages-ux/01-TASK-PAGE.md` and `docs/pages-ux/02-CATALOG-PAGE.md` are authoritative for Task Page and Catalog Page UX decisions respectively.
- `CONTEXT.md` is authoritative for terminology, including the Challenge ID, Challenge Registry, Catalog Page, Task Page, Difficulty, and Tags entries added for this feature.
