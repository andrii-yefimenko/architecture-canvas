# Contract: Challenge Authoring

**Module**: `src/challenges/challenge-01.ts` | **Source of truth for content**: [`MVP.md`](../../../MVP.md)

A Challenge is authored data, not code. This contract defines the shape and the integrity rules that authored data must satisfy, so that adding Challenge #2 later is a matter of writing another module rather than changing the application.

## Shape

```ts
export const challenge01: Challenge = {
  id: 'challenge-01',
  title: string,
  description: string,
  visibleRequirements: string[],
  hiddenRequirementCategories: [
    { id: CategoryId, name: string, requirements: string[] },
    // ...
  ],
  services: [
    { id: ServiceId, name: string, category: string },
    // ...
  ],
  rules: [
    { id: RuleId, kind: 'presence',    description, recommendation, serviceId },
    { id: RuleId, kind: 'containment', description, recommendation, serviceId, parentServiceId },
    // ...
  ],
};
```

## Integrity rules

Enforced by `challenge-01.test.ts`, which exists specifically to catch authoring mistakes at test time rather than as a wrong Score at runtime. This is the exact defect class the documentation audit found in prose (`"Backend EC2"` versus `"EC2 (Backend)"`).

1. **Service ids are unique** within `services`.
2. **Rule ids are unique** within `rules`.
3. **Category ids are unique** within `hiddenRequirementCategories`.
4. **Every `serviceId` referenced by a Rule resolves** to an entry in `services`.
5. **Every `parentServiceId` referenced by a containment Rule resolves** to an entry in `services`.
6. **Every Rule has a non-empty `description` and `recommendation`** — FR-024 requires a Recommendation for every possible failure, so none may be blank.
7. **`visibleRequirements` is non-empty** — FR-002 requires something to display on load.
8. **Every Category has at least one requirement** — an empty Category would render a reveal control that does nothing.

## Content requirements for Challenge #1

Transcribed from `MVP.md`; the authored module must not paraphrase or reorder.

- **Categories**: exactly four — Infrastructure, Presentation Tier, Application Tier, Data Tier.
- **Rules**: exactly eleven, in `MVP.md`'s numbered order, so the rendered checklist matches the document.
- **Services**: the full catalog from `MVP.md`'s "Available Services", including the distractors (CloudFront, Route 53, Direct Connect, Lambda, ECS, EKS, Fargate, Elastic Beanstalk, Aurora, DynamoDB, ElastiCache, S3, S3 Glacier, EBS, EFS). The distractors are the point — a catalog containing only correct answers would not test judgement.
- **Compute Services carry roles**: "EC2 (Frontend)" and "EC2 (Backend)" are separate entries with separate ids (FR-010).

## Recommendation wording

Each Recommendation states the corrective action and its reasoning, following `MVP.md`'s worked example:

> Place the EC2 backend in a private subnet to prevent unauthorized access.

Action first, reason second. SC-003 requires every failed Rule to name a specific corrective action, so a Recommendation that only restates the Rule ("The backend is not in a private subnet") does not satisfy this contract.

## Adding a Challenge later

Out of scope for the MVP and tracked in `docs/03-BACKLOG.md`, but the shape is designed not to obstruct it: a new Challenge is a new module satisfying this contract. Because the evaluator takes `rules` as a parameter rather than importing them, no application code changes. Selecting between Challenges is the only genuinely new work.
