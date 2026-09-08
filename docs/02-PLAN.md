# Project Roadmap & Execution Plan

**Current Version**: `v0.2.0`  
**Target Milestone**: `v0.3.0` (2D Free-form Canvas & Node Visualization)  
**Methodology**: SpecKit-driven (Docs -> Brainstorm/Grill -> Spec -> Tasks -> Code)

---

## 1. Guiding Principles & Hard Constraints

1. **Domain Purity (ADR 0001)**: `src/domain/` must remain 100% framework-agnostic. No React, no DOM, no rendering logic. Evaluation operates on pure data.
2. **Minimal Dependencies**: Do not introduce heavy third-party libraries without a formal ADR and explicit trade-off justification.
3. **Additive Evolution**: New features must not break existing test harnesses or render previous challenges unplayable.
4. **Data Isolation**: Multi-challenge states remain strictly scoped by `challengeId`.

---

## 2. Milestone Roadmap

### v0.1.0 - MVP (Completed)
- 3-panel workspace (Requirements, Services, Canvas).
- Challenge #1 (Simple Web Application, 3-tier VPC).
- Client-side evaluation engine (`evaluate(tree, rules)`).
- Full containerization & 197 passing tests.

### v0.2.0 - Multi-Challenge Platform (Completed)
- Catalog Page (`/`) with difficulty badges and tags.
- Task Page (`/challenge/:id`) with hand-rolled `useRoute()`.
- Challenge #2 (High-Availability Containerized Web App).
- Challenge-scoped persistent storage (`architecture-canvas:session:${challengeId}`).
- 265 passing tests.

### v0.3.0 - 2D Free-form Canvas Engine (Current Focus)
**Goal**: Transition from vertical flex-tree drop-zones to an AWS-like 2D spatial workspace (CloudFormation / Application Composer style).


### v0.x.x - Connectors & Explicit Relationships (Future)
- Directed connection lines (arrows between nodes, e.g. ALB -> ECS -> RDS).
- Port/Security group relationship evaluation.

### v.0.x.x - Logic and Evaluation Engines (Future)
- Unified scoring logic across challenges.
- Granular rule evaluation engines.

### v0.x.x - AI Architecture Reviewer & Interviewer (Future)
- LLM integration for dynamic feedback on failed rules.
- Interactive requirement discovery via chat.

---

## 3. Decision Log & Conventions


## 4. Backlog
- High-level backlog items and future enhancements are tracked in `docs/03-BACKLOG.md`.