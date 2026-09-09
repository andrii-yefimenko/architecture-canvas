# Contract: Challenge Authoring (Service render kind added)

**Module**: `src/challenges/challenge-01.ts`, `src/challenges/challenge-02.ts` | **Source of truth for the new field's assignment**: this contract

**Supersedes**: `specs/001-architecture-canvas-mvp/contracts/challenge.md`. Everything below replaces that contract's Shape and Integrity rules sections; its Content-requirements and Recommendation-wording sections carry forward unmodified and are not restated here.

## Shape *(one field added to `services`)*

```ts
export const challenge01: Challenge = {
  // ... id, title, description, visibleRequirements, hiddenRequirementCategories,
  //     rules, difficulty, tags, shortDescription — all unchanged
  services: [
    { id: ServiceId, name: string, category: string, renderKind: 'frame' | 'card' },
    // ...
  ],
};
```

## Integrity rules *(one added)*

Rules 1–8 from `specs/001-architecture-canvas-mvp/contracts/challenge.md` carry forward unmodified (unique Service/Rule/Category ids, every Rule's `serviceId`/`parentServiceId` resolves, non-empty Recommendations, non-empty `visibleRequirements`, every Category non-empty).

9. **Every Service declares a `renderKind`.** Enforced by `challenge-01.test.ts` / `challenge-02.test.ts`, the same way rules 1–8 already are — an authoring mistake (a missing or misspelled `renderKind`) is a test failure, not a wrong-looking Canvas discovered at runtime.

## `renderKind` assignment rule

A Service is `'frame'` if it represents a real AWS networking or orchestration **boundary** — something that, in an actual AWS architecture diagram, is drawn as a region containing other resources. Every other Service is `'card'`.

**`'frame'`**: VPC, Public Subnet, Private Subnet, and (Challenge #2 only) ECS Cluster.

**`'card'`**: everything else in both catalogs — every compute, storage, database, and standalone networking-endpoint Service, including every distractor (Internet Gateway, NAT Gateway, EC2 (Frontend), EC2 (Backend), RDS, Fargate Task, Application Load Balancer, CloudFront, Route 53, Direct Connect, Lambda, EKS, standalone Fargate, Elastic Beanstalk, Aurora, DynamoDB, ElastiCache, S3, S3 Glacier, EBS, EFS).

This is independent of a Service's `category` field (`src/domain/types.ts`'s existing Services-panel display grouping) — see `research.md`'s "Service catalog: `renderKind`" for why the two are kept separate. It is also independent of whether a *particular Node* of that Service ever actually contains anything: an empty VPC is still `'frame'`-shaped (a visibly larger frame, per `contracts/canvas-layout.md`'s `MIN_FRAME_SIZE`), and a `'card'`-kind Node that gains a child still promotes to a Frame at render time (`FR-002`) — the `renderKind` field only ever picks the *default, empty-state* appearance.

## Adding a Service later

Per rule 9, any new Service added to either catalog (or a future Challenge's) must declare `renderKind` at authoring time — the integrity test fails immediately if it's omitted, the same safety net rule 4 already gives Rule → Service id references.
