# Quickstart & Validation Guide: Architecture Canvas MVP

**Date**: 2026-08-30 | **Plan**: [plan.md](./plan.md)

How to run the application and prove it satisfies the specification. Written to be executable once implementation lands — nothing here exists yet.

## Prerequisites

- Node.js 20+ and npm (local development)
- Docker 20.10+ and Docker Compose 2.0+ (container run)
- A modern desktop browser

## Running

### Local development

```bash
npm install
npm run dev          # Vite dev server, hot reload
```

### Test suite

```bash
npm test             # Vitest, single run
npm run test:watch   # Watch mode — the loop for Phase B domain work
npm run test:ui      # Vitest UI, optional
```

### Production container

```bash
docker compose up --build -d
```

Then open <http://localhost:3000>. This is the flow `README.md` documents, and it must work exactly as written — `MVP.md`'s acceptance criteria depend on it.

```bash
docker compose down
```

## Validation scenarios

Each scenario maps to a user story in [spec.md](./spec.md) and is automated in `tests/integration/`. Run them manually to validate end to end.

### Scenario 1 — Design and evaluate (US1, P1)

*Automated in `tests/integration/design-and-evaluate.test.tsx`*

1. Open the application. **Expect**: Challenge title, description, and all Visible Requirements displayed; Services listed and grouped by category; empty Canvas.
2. Drag a VPC onto the Canvas. **Expect**: a VPC Node appears at root level.
3. Drag a Public Subnet **into** the VPC Node. **Expect**: it nests inside, visibly contained.
4. Drag an EC2 (Frontend) into the Public Subnet. **Expect**: nests two levels deep.
5. Press Submit. **Expect**: a Score, and a checklist showing **all 11 Rules** with pass/fail — not failures alone (FR-023).
6. Inspect a failed Rule. **Expect**: a Recommendation naming a specific corrective action (SC-003).

**Full-marks check (SC-002)**: build the architecture from `MVP.md`'s Required Architecture — VPC containing Internet Gateway, Public Subnet (holding NAT Gateway and EC2 Frontend), and Private Subnet (holding EC2 Backend and RDS). Submit. **Expect a Score of exactly 100** and 11 of 11 passed. A result of 99 means Score rounding was applied per-Rule instead of once at display (FR-027).

### Scenario 2 — Discover Hidden Requirements (US2, P2)

*Automated in `tests/integration/reveal-requirements.test.tsx`*

1. On load, **expect** no Hidden Requirement text visible and exactly four reveal controls — Infrastructure, Presentation Tier, Application Tier, Data Tier.
2. Reveal "Application Tier". **Expect** its requirements appear and the other three Categories stay concealed.
3. Reveal the rest. **Expect** all requirements visible.
4. **Score-neutrality check (FR-007)**: build an identical Canvas Tree in two sessions, revealing all Categories in one and none in the other. **Expect identical Scores.**

### Scenario 3 — Revise and resubmit (US3, P3)

*Automated in `tests/integration/revise-and-resubmit.test.tsx`*

1. Submit a Canvas Tree with the backend in the *public* subnet. **Expect** the containment Rule fails with a Recommendation.
2. Drag the EC2 (Backend) into the Private Subnet. **Expect** the Evaluation **stays on screen**, marked as applying to the previous submission (FR-030). It must not clear — the Recommendations are what the user is reading while fixing.
3. Submit again. **Expect** fresh results, stale marking gone, Score risen, that Rule now passing.
4. Submit several more times. **Expect** every submission accepted; the Canvas never locks (FR-029).

### Scenario 4 — Resume a session (US4, P4)

*Automated in `tests/integration/session-resume.test.tsx`*

1. Build a nested Canvas Tree and reveal two Categories.
2. Reload the browser. **Expect** the Canvas Tree restored with identical structure, those two Categories still revealed, the other two still concealed, and **no Evaluation displayed** (FR-034).
3. **Incompatible-state check (FR-033)**: edit the stored envelope's `version` in devtools, reload. **Expect** a clean empty Canvas, not a crash.
4. **Storage-unavailable check (SC-009)**: open in a private window with site data blocked. **Expect** the application fully usable, with no error surfaced; only restoration after reload is lost.

## Edge cases to verify manually

| Case | Expected |
|---|---|
| Submit an untouched Canvas | Score 0, all 11 Rules failed with Recommendations. No error, and the submit control was never disabled (FR-025, SC-007). |
| Place two VPCs, one correct | Rules pass. Duplicates neither help nor hurt (FR-022). |
| Nest EC2 (Backend) one level too deep | Containment Rule **fails** — direct parent only (FR-021). |
| Drag a VPC into an RDS Node | Accepted. Structurally absurd placements are allowed and judged by the Evaluation, never blocked (FR-012). |
| Drag a container into its own child | **Rejected**; tree unchanged. The one structural exception — see [research R-02](./research.md). |
| Delete a Subnet holding two Nodes | Confirmation prompt first; on confirm the whole subtree goes (FR-016, FR-017). |
| Delete an empty Node | Removed immediately, no prompt. |
| Drag over a container mid-drag | **No** highlight or valid/invalid signal (FR-013). |

## Definition of done

- [ ] `npm test` passes with the evaluator's 11 contract cases green ([contracts/evaluator.md](./contracts/evaluator.md))
- [ ] All four integration scenarios pass
- [ ] `docker compose up --build -d` serves the app at `localhost:3000`
- [ ] The Required Architecture scores exactly 100
- [ ] An empty Canvas scores 0 without erroring
- [ ] Every `MVP.md` acceptance-criteria checkbox is satisfied
