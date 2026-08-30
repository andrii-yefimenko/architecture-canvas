# Feature Specification: Architecture Canvas MVP

**Feature Branch**: `docs/spec-initial`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Parse all root documents and docs/ files as ground truth to generate the complete technical architecture breakdown, task list, and feature specs for the Architecture Canvas MVP. Constraints: React + TypeScript + Vite + Tailwind + dnd-kit client-side SPA with zero backend; hierarchical nested-container Canvas Tree with direct-child-only matching and existential Rules; Docker static build served via nginx on port 3000; strict canonical terminology from CONTEXT.md."

**Ground truth**: `PROJECT.md`, `MVP.md`, `README.md`, `CONTEXT.md`, `docs/01-RESEARCH.md`, `docs/02-PRODUCT-UX.md`, `docs/04-TECH-STACK.md`, `docs/adr/0001-client-side-validation-engine.md`

**Terminology**: This specification uses the canonical vocabulary defined in `CONTEXT.md` — **Service**, **Node**, **Canvas Tree**, **Challenge**, **Visible Requirement**, **Hidden Requirement**, **Hidden Requirement Category**, **Rule**, **Evaluation**, **Recommendation**, **Score**. These are domain terms, not implementation names.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Design an Architecture and Receive an Evaluation (Priority: P1)

A practicing engineer opens the platform and sees a Challenge: a title, a description of the business situation, and the Visible Requirements. They drag Services from the catalog onto the Canvas, nesting them to express the architecture they think satisfies the brief. When ready, they submit and immediately receive a Score plus a per-Rule breakdown showing what they got right, what they missed, and what to change.

**Why this priority**: This is the entire product thesis in one loop — open-ended design followed by structural review. Every other story enriches this loop but none replaces it. Shipped alone, this already delivers something no cloud lab or interview-prep tool offers.

**Independent Test**: Load the application, drag Services onto the Canvas to form a nested structure, submit, and confirm a Score and a complete pass/fail breakdown appear. Delivers value with Hidden Requirements, revision, and persistence all absent.

**Acceptance Scenarios**:

1. **Given** the application has just loaded, **When** the user reads the Requirements panel, **Then** the Challenge title, description, and all Visible Requirements are displayed.
2. **Given** the Services panel is displayed, **When** the user inspects it, **Then** every Service available for this Challenge is listed, grouped by its category.
3. **Given** an empty Canvas, **When** the user drags a Service onto it, **Then** a Node of that Service appears on the Canvas at the drop location.
4. **Given** a Node exists on the Canvas, **When** the user drags another Service into it, **Then** the second Node becomes a child of the first in the Canvas Tree.
5. **Given** a Canvas Tree matching the Challenge's expected architecture, **When** the user submits, **Then** the Score is 100 and every Rule is reported as passed.
6. **Given** a Canvas Tree with one misplaced Node, **When** the user submits, **Then** the corresponding Rule is reported as failed and displays a Recommendation naming what to change.

---

### User Story 2 - Discover Hidden Requirements (Priority: P2)

The Challenge deliberately withholds most of its requirements. The user sees only the headline brief and must ask for detail — revealing requirements one Category at a time, simulating a client who has to be interviewed before their real constraints surface.

**Why this priority**: This is the platform's core differentiator per `docs/01-RESEARCH.md` — the requirements-gathering skill that interview-prep and lab platforms skip entirely. It is P2 rather than P1 only because the design-and-evaluate loop must exist first for it to have anything to feed.

**Independent Test**: Confirm Hidden Requirements are concealed on load, that each Category's reveal control exposes exactly that Category's requirements, and that revealing changes no Score.

**Acceptance Scenarios**:

1. **Given** the application has just loaded, **When** the user views the Requirements panel, **Then** no Hidden Requirement text is visible, and one reveal control is shown per Hidden Requirement Category.
2. **Given** a concealed Hidden Requirement Category, **When** the user activates its reveal control, **Then** every Hidden Requirement in that Category becomes visible and remains visible.
3. **Given** one Category revealed and three still concealed, **When** the user views the panel, **Then** the other three Categories' requirements remain concealed.
4. **Given** two users submit identical Canvas Trees, one having revealed all Categories and one having revealed none, **When** both submit, **Then** both receive an identical Score.

---

### User Story 3 - Revise and Resubmit (Priority: P3)

Having read the Evaluation, the user rearranges the Canvas to address the failures and submits again — as many times as they like — watching the Score move as their reasoning improves.

**Why this priority**: Converts a one-shot test into a practice loop, which is the stated goal in `PROJECT.md`. Depends on P1 producing an Evaluation to react to.

**Independent Test**: Submit a deliberately flawed Canvas Tree, correct one failing Rule, resubmit, and confirm the Score rises and that Rule now passes.

**Acceptance Scenarios**:

1. **Given** an Evaluation is displayed, **When** the user modifies the Canvas Tree, **Then** the Evaluation remains visible and is clearly marked as applying to the previous submission.
2. **Given** a stale Evaluation is displayed, **When** the user submits again, **Then** the Evaluation is replaced with fresh results and the stale marking is removed.
3. **Given** a user has submitted five times, **When** they submit a sixth time, **Then** the submission is accepted and evaluated normally.
4. **Given** a failed Rule and its Recommendation, **When** the user applies that Recommendation and resubmits, **Then** that Rule passes.

---

### User Story 4 - Resume an In-Progress Session (Priority: P4)

The user closes the tab mid-design, returns later, and finds their partly built Canvas Tree and the requirements they had already uncovered exactly as they left them.

**Why this priority**: Pure frustration-avoidance rather than new capability — valuable but the product works without it.

**Independent Test**: Build a Canvas Tree, reveal some Categories, reload the browser, and confirm both are restored.

**Acceptance Scenarios**:

1. **Given** a Canvas Tree with several nested Nodes, **When** the user reloads the page, **Then** the Canvas Tree is restored with identical structure.
2. **Given** two revealed Hidden Requirement Categories, **When** the user reloads, **Then** those two Categories remain revealed and the others remain concealed.
3. **Given** stored session data that no longer matches the current Challenge structure, **When** the user loads the application, **Then** the application starts from a clean empty state rather than failing.

---

### Edge Cases

- **Empty submission**: Submitting an untouched Canvas yields a Score of 0 with every Rule reported as failed and each showing its Recommendation — not an error, and not a blocked action.
- **Duplicate Nodes**: Placing several Nodes of the same Service (two VPCs, three frontends) neither raises nor lowers the Score; a Rule passes if at least one Node satisfies it.
- **Over-nested Nodes**: A Node placed inside an unexpected intermediate parent fails its containment Rule, because containment is satisfied only by a direct parent.
- **Structurally nonsensical placement**: Nothing prevents dropping a VPC inside a database. The Canvas accepts it; the Evaluation reports the resulting failures.
- **Deleting a populated container**: Deleting a Node that has children removes the entire subtree, and requires explicit confirmation first.
- **Nodes at Canvas root**: A Service dropped on empty Canvas becomes a root-level Node, valid to place but failing any Rule requiring containment.
- **All Categories revealed**: The Requirements panel shows every requirement, with reveal controls in a spent state; the Score is unaffected.
- **Unavailable local storage**: If session storage cannot be written (private browsing, disabled storage), the application remains fully usable for the current session and silently forgoes persistence.

## Requirements *(mandatory)*

### Functional Requirements

**Challenge presentation**

- **FR-001**: System MUST display the Challenge title and description on load.
- **FR-002**: System MUST display all Visible Requirements on load, without user action.
- **FR-003**: System MUST conceal all Hidden Requirements on load.
- **FR-004**: System MUST present exactly one reveal control per Hidden Requirement Category.
- **FR-005**: Activating a Category's reveal control MUST reveal every Hidden Requirement in that Category and no requirement outside it.
- **FR-006**: Revealed Hidden Requirements MUST remain revealed for the rest of the session.
- **FR-007**: Revealing Hidden Requirements MUST NOT affect the Score.

**Service catalog**

- **FR-008**: System MUST display all Services available to the Challenge, grouped by their category.
- **FR-009**: Each Service MUST be individually draggable onto the Canvas.
- **FR-010**: Services whose type encodes a role (for example a frontend compute instance versus a backend compute instance) MUST appear as separate catalog entries; the system MUST NOT require post-placement configuration to establish a Node's role.

**Canvas and Canvas Tree**

- **FR-011**: Dragging a Service onto the Canvas MUST create a Node of that Service.
- **FR-012**: System MUST allow any Node to be placed inside any other Node, or at the Canvas root, with no placement restriction.
- **FR-013**: System MUST NOT indicate during a drag whether a prospective parent is structurally valid.
- **FR-014**: Each Node MUST carry an identity distinct from every other Node, including Nodes of the same Service.
- **FR-015**: Moving a Node MUST move all of its descendants with it, preserving their relative structure.
- **FR-016**: Deleting a Node MUST delete all of its descendants.
- **FR-017**: Deleting a Node that has at least one child MUST require explicit user confirmation before proceeding.
- **FR-018**: The Canvas MUST represent Node relationships solely as parent-child containment; the MVP has no connections or edges between Nodes.

**Evaluation**

- **FR-019**: The submit control MUST be available at all times, regardless of Canvas Tree state.
- **FR-020**: Submitting MUST evaluate the current Canvas Tree against every Rule defined by the Challenge.
- **FR-021**: A Rule requiring a Node to be contained within another MUST pass only when that container is the Node's direct parent.
- **FR-022**: Rules MUST be existential — a Rule passes when at least one Node satisfies it, and additional satisfying or non-satisfying Nodes MUST NOT change the outcome.
- **FR-023**: The Evaluation MUST report every Rule with an explicit passed or failed status, not failures alone.
- **FR-024**: Every failed Rule MUST display a Recommendation describing what to change and why.
- **FR-025**: An empty Canvas Tree MUST produce a Score of 0 and a complete list of failed Rules, without erroring or blocking.

**Score**

- **FR-026**: Each passed Rule MUST contribute an equal share of 100 points, computed as 100 divided by the Challenge's total Rule count.
- **FR-027**: Points MUST be summed at full precision and rounded only for display, so a fully correct Canvas Tree scores exactly 100.
- **FR-028**: The Score MUST be displayed alongside the count of passed Rules out of the total.

**Iteration and persistence**

- **FR-029**: System MUST accept unlimited resubmissions; the Canvas MUST NOT lock after a submission.
- **FR-030**: Modifying the Canvas Tree after a submission MUST leave the previous Evaluation visible and mark it as applying to the previous submission.
- **FR-031**: Submitting again MUST replace the displayed Evaluation and clear the stale marking.
- **FR-032**: System MUST persist the Canvas Tree and the set of revealed Hidden Requirement Categories, restoring them on reload.
- **FR-033**: System MUST discard persisted state that is incompatible with the current Challenge structure and start from a clean empty state rather than failing.
- **FR-034**: System MUST NOT persist the Evaluation; a reloaded session begins with no results displayed.

**Layout**

- **FR-035**: The interface MUST present three vertical regions — Requirements, Canvas, Services — beneath a header, with the Canvas as the largest region.
- **FR-036**: The header MUST contain the submit control.
- **FR-037**: The Score and Evaluation MUST appear within the Requirements region after a submission.

### Key Entities

- **Challenge**: One complete exercise. Holds a title, description, Visible Requirements, Hidden Requirements grouped into Categories, its Service catalog, and its Rules. The MVP contains exactly one.
- **Service**: A catalog definition available to drag — a type, not a placed thing. Belongs to a display category. Its type encodes its role.
- **Node**: A placed instance of a Service on the Canvas. Has its own identity, at most one parent, and any number of children. Multiple Nodes may share a Service type.
- **Canvas Tree**: The nested hierarchy of Nodes. Relationships are strictly parent-child. This is the Evaluation's input and the unit of persistence.
- **Visible Requirement**: A requirement shown immediately, without user action.
- **Hidden Requirement**: A requirement withheld until revealed. Belongs to exactly one Hidden Requirement Category.
- **Hidden Requirement Category**: A named group of Hidden Requirements revealed together as a unit — the interview question the user chooses to ask.
- **Rule**: One checkable condition evaluated against the Canvas Tree, either about a Node's existence or its direct containment. Passes or fails; no partial result. Carries a Recommendation for the failure case.
- **Evaluation**: The result of running every Rule against the Canvas Tree — each Rule's status, the Recommendations for failures, and the resulting Score. May be marked stale when the Canvas Tree has changed since it was produced.
- **Recommendation**: Guidance attached to a failed Rule, stating the corrective action and its reasoning.
- **Score**: The number derived from an Evaluation — passed Rules as a proportion of total, expressed out of 100.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user completes the full loop — read the Challenge, reveal Hidden Requirements, build a Canvas Tree, submit, read the Evaluation — in under 5 minutes without external instruction.
- **SC-002**: A Canvas Tree matching the Challenge's expected architecture scores exactly 100, with every Rule reported as passed.
- **SC-003**: 100% of failed Rules display a Recommendation that names a specific corrective action.
- **SC-004**: A user can determine the pass/fail status of every one of the Challenge's requirements from the Evaluation alone, without consulting any other material.
- **SC-005**: After a browser reload, 100% of placed Nodes and revealed Hidden Requirement Categories are restored with identical structure.
- **SC-006**: A user revising a failed solution retains access to the previous Evaluation throughout the revision, with zero interactions required to keep it visible.
- **SC-007**: An empty submission returns a Score of 0 with a complete list of unmet requirements, and never an error state or a disabled control.
- **SC-008**: Applying every Recommendation from an Evaluation and resubmitting raises the Score in every case.
- **SC-009**: The application remains fully usable for the duration of a session even when the browser cannot save session data, with no error shown and no loss of current work.

## Assumptions

**Scope**

- The MVP contains exactly one Challenge ("Simple web application", per `MVP.md`). Multiple Challenges, dynamic Challenge generation, multiple cloud providers, and advanced validation are out of scope and logged in `docs/03-BACKLOG.md`.
- No AI features of any kind. The Hidden Requirement reveal is a static disclosure, not a conversation; the Evaluation is rule-based, not generated. The AI client chat and AI reviewer described in `PROJECT.md` §4 are future product, explicitly excluded here.
- No user accounts, authentication, profiles, or cross-device sync. A session is anonymous and local to one browser.
- No score history across attempts; only the most recent Evaluation is shown.
- Desktop-first. The primary interaction is drag-and-drop architecture design, which assumes a pointer and a wide viewport. Small-screen and touch support are not targeted.
- English-language interface only. No analytics or telemetry.

**Pre-decided technical constraints** *(settled in `docs/04-TECH-STACK.md` and `docs/adr/0001-client-side-validation-engine.md`; recorded here as inputs, with elaboration belonging to `/speckit-plan`)*

- The system is a client-side single-page application with **no backend service**. The Evaluation runs in the browser against Rules bundled with the application. The accepted consequence — a determined user can read the Rules in browser developer tools — is documented and accepted in ADR 0001, since the audience is self-motivated learners and no credential or ranking attaches to a Score.
- Stack: React, TypeScript, Vite, Tailwind CSS, dnd-kit.
- Persistence uses browser local storage under a single versioned key, which is what makes FR-033's clean-discard behavior possible.
- Challenge content is authored as a typed module bundled with the application, not fetched.
- Deployment is a static production build served by nginx on port 3000 via Docker Compose.
- Node-graph libraries were rejected: the Canvas is nested containers with no edges, not a graph.

**Environment**

- Users run a current desktop browser with JavaScript enabled and drag-and-drop support.
- Local storage is available in the common case; its absence degrades persistence only, never core function (SC-009).

## Dependencies

- No external services, APIs, or third-party data sources. The application is fully self-contained at runtime.
- `MVP.md` is the authoritative source for Challenge #1's content: its description, Visible and Hidden Requirements, Service catalog, expected architecture, and its Rules with their Recommendations.
- `CONTEXT.md` is the authoritative source for terminology used in code, tests, and documentation.
