# Quickstart & Validation Guide: Multi-Challenge Catalog & Challenge #2

**Date**: 2026-09-02 | **Plan**: [plan.md](./plan.md)

How to run the application and prove it satisfies this feature's specification. Written to be executable once implementation lands — nothing here exists yet. Prerequisites and run commands are unchanged from `specs/001-architecture-canvas-mvp/quickstart.md`.

## Prerequisites

- Node.js 20+ and npm (local development)
- Docker 20.10+ and Docker Compose 2.0+ (container run)
- A modern desktop browser

## Running

```bash
npm install
npm run dev          # Vite dev server, hot reload — now opens the Catalog Page at /
```

```bash
npm test             # Vitest, single run
```

```bash
docker compose up --build -d   # then open http://localhost:3000
```

## Validation scenarios

Each scenario maps to a user story in [spec.md](./spec.md).

### Scenario 1 — Discover and launch a Challenge from the Catalog (US1, P1)

1. Open `http://localhost:3000/`. **Expect**: a Catalog Page showing exactly two cards, in Registry order — Challenge #1 ("Simple web application") first, Challenge #2 ("Containerized Microservice with ECS Fargate") second.
2. Inspect a card. **Expect**: title, Difficulty, short description, and Tags are all visible, plus a Start Challenge control.
3. Activate Start Challenge on the second card. **Expect**: the URL becomes `/challenge/challenge-02` and the Task Page loads showing Challenge #2's own title and requirements — no full page reload (check the network tab: no new `index.html` request).
4. Activate the header's Back to Catalog control. **Expect**: back at `/`, the same two cards.
5. Manually navigate to `/challenge/does-not-exist`. **Expect**: the Catalog Page, not a broken page or console error.
6. Use the browser's back button after step 3. **Expect**: same result as step 4 — back at the Catalog Page.

### Scenario 2 — Complete Challenge #2 end to end (US2, P1)

1. From the Catalog, start Challenge #2. **Expect**: Visible Requirements about a Layer 7 load balancer, serverless container orchestration, and a managed relational database — not Challenge #1's frontend/backend/database wording.
2. Inspect the Services panel. **Expect**: ECS Cluster, Fargate Task, Application Load Balancer, RDS, and the rest of Challenge #2's catalog — not Challenge #1's EC2 (Frontend)/EC2 (Backend)-centric one (though those two do appear here too, as unscored distractors).
3. Build the architecture from `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`'s Required Architecture: VPC containing an Internet Gateway, a Public Subnet (holding the ALB and NAT Gateway), and a Private Subnet (holding an ECS Cluster with a nested Fargate Task, and RDS).
4. Submit. **Expect a Score of exactly 100** and 9 of 9 Rules passed.
5. Move the ECS Cluster to the Public Subnet and resubmit. **Expect**: that Rule fails with a Recommendation naming the correction (mirrors `docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md`'s Failure Example).

### Scenario 3 — Work stays isolated between Challenges (US3, P2)

1. Start Challenge #1, build a partial Canvas Tree (e.g. a VPC with a Public Subnet inside), do **not** submit.
2. Navigate directly to `/challenge/challenge-02` (type the URL, don't use Back to Catalog). **Expect**: Challenge #2's Canvas is completely empty — none of Challenge #1's Nodes appear, even though both Challenges use a Service literally called `vpc`.
3. Navigate directly back to `/challenge/challenge-01`. **Expect**: the VPC and Public Subnet from step 1 are restored exactly as left.
4. Hard-refresh the browser while on Challenge #1's Task Page. **Expect**: same restoration as step 3 — a reload alone doesn't lose anything.

### Scenario 4 — Leaving a Challenge clears its session (US4, P3)

1. Start either Challenge, place at least one Node, reveal at least one Hidden Requirement Category.
2. Activate Back to Catalog.
3. Start the same Challenge again. **Expect**: empty Canvas, no revealed Categories — identical to a first-ever visit, not a restoration of step 1's state.
4. Contrast with Scenario 3 step 4: a reload restores, but a deliberate return to the Catalog does not. This distinction is the point of this feature's persistence model — see `docs/pages-ux/01-TASK-PAGE.md`'s Persistence section.

## Edge cases to verify manually

| Case | Expected |
|---|---|
| Load `/challenge/challenge-02` directly (deep link, no prior Catalog visit) | Loads Challenge #2's Task Page directly — no server change was needed; `nginx.conf`'s existing SPA fallback already covers this. |
| Two browser tabs open on different Challenges | Each tab's Canvas reflects only its own Challenge; no cross-tab bleed, since each Challenge has its own storage key. |
| Open Challenge #2, place an RDS Node, then reopen `/` and re-enter Challenge #2 via a card click | Same result as the Back to Catalog control — the Canvas is empty, since the Catalog Page is the same clearing trigger regardless of navigation method. |
| Submit an untouched Canvas on Challenge #2 | Score 0, all 9 Rules reported as failed with Recommendations — no error, mirrors Challenge #1's existing empty-submission behavior. |
| Place two ECS Clusters on Challenge #2, one correctly nested | Rules pass; duplicates neither help nor hurt, same existential semantics as Challenge #1. |

## Definition of done

- [ ] `npm test` passes, including the new Challenge Registry integrity tests ([contracts/challenge-registry.md](./contracts/challenge-registry.md)), routing tests ([contracts/routing.md](./contracts/routing.md)), and the 14 persistence contract cases ([contracts/persistence.md](./contracts/persistence.md))
- [ ] All four validation scenarios above pass
- [ ] `docker compose up --build -d` serves the Catalog Page at `localhost:3000/` and both Challenges are reachable and playable from it
- [ ] Challenge #2's Required Architecture scores exactly 100
- [ ] No user-observable regression to any Challenge #1 behavior verified in `specs/001-architecture-canvas-mvp/quickstart.md`
