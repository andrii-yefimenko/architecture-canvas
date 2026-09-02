/**
 * Referential-integrity guards for authored Challenge data.
 *
 * Mirrors challenge-01.test.ts's checks. See contracts/challenge-registry.md
 * in specs/002-multi-challenge-catalog/, which extends
 * specs/001-architecture-canvas-mvp/contracts/challenge.md for this Challenge.
 */

import { challenge02 } from './challenge-02';

const serviceIds = new Set(challenge02.services.map((s) => s.id));

describe('identifier uniqueness', () => {
  it('has unique Service ids', () => {
    expect(serviceIds.size).toBe(challenge02.services.length);
  });

  it('has unique Rule ids', () => {
    const ids = new Set(challenge02.rules.map((r) => r.id));
    expect(ids.size).toBe(challenge02.rules.length);
  });

  it('has unique Hidden Requirement Category ids', () => {
    const ids = new Set(challenge02.hiddenRequirementCategories.map((c) => c.id));
    expect(ids.size).toBe(challenge02.hiddenRequirementCategories.length);
  });
});

describe('Rule references resolve to the Service catalog', () => {
  it.each(challenge02.rules.map((r) => [r.id, r.serviceId] as const))(
    'Rule %s references a known serviceId (%s)',
    (_ruleId, serviceId) => {
      expect(serviceIds.has(serviceId)).toBe(true);
    },
  );

  it('every containment Rule references a known parentServiceId', () => {
    for (const rule of challenge02.rules) {
      if (rule.kind === 'containment') {
        expect(serviceIds.has(rule.parentServiceId)).toBe(true);
      }
    }
  });
});

describe('content completeness', () => {
  it('every Rule has a non-empty description and recommendation', () => {
    for (const rule of challenge02.rules) {
      expect(rule.description.trim().length).toBeGreaterThan(0);
      expect(rule.recommendation.trim().length).toBeGreaterThan(0);
    }
  });

  it('every Recommendation is more than a restatement of its description', () => {
    for (const rule of challenge02.rules) {
      expect(rule.recommendation).not.toBe(rule.description);
      expect(rule.recommendation.length).toBeGreaterThan(rule.description.length);
    }
  });

  it('has non-empty visible requirements', () => {
    expect(challenge02.visibleRequirements.length).toBeGreaterThan(0);
  });

  it('every Category has at least one requirement', () => {
    for (const category of challenge02.hiddenRequirementCategories) {
      expect(category.requirements.length).toBeGreaterThan(0);
    }
  });

  it('has a title and description', () => {
    expect(challenge02.title.trim().length).toBeGreaterThan(0);
    expect(challenge02.description.trim().length).toBeGreaterThan(0);
  });
});

describe('Challenge #2 shape, per docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md', () => {
  it('has exactly 9 Rules', () => {
    expect(challenge02.rules).toHaveLength(9);
  });

  it('uses only presence and containment Rule kinds — no new Rule kind for this Challenge', () => {
    for (const rule of challenge02.rules) {
      expect(['presence', 'containment']).toContain(rule.kind);
    }
  });

  it('has exactly 4 Hidden Requirement Categories', () => {
    expect(challenge02.hiddenRequirementCategories.map((c) => c.name)).toEqual([
      'Infrastructure',
      'Presentation & Ingress',
      'Compute (Containers)',
      'Data Tier',
    ]);
  });

  it('lists the Rules in the source document order', () => {
    expect(challenge02.rules.map((r) => r.id)).toEqual([
      'vpc-exists',
      'public-subnet-in-vpc',
      'private-subnet-in-vpc',
      'internet-gateway-in-vpc',
      'alb-in-public-subnet',
      'nat-gateway-in-public-subnet',
      'ecs-cluster-in-private-subnet',
      'fargate-task-in-ecs-cluster',
      'rds-in-private-subnet',
    ]);
  });

  it('models the container compute path as its own Services', () => {
    expect(serviceIds.has('ecs-cluster')).toBe(true);
    expect(serviceIds.has('fargate-task')).toBe(true);
  });

  it('includes EC2 (Frontend) and EC2 (Backend) as unscored distractors', () => {
    // No Rule references either — the point is the catalog offers the legacy
    // pattern without rewarding or penalizing it (docs/03-BACKLOG.md Q2).
    expect(serviceIds.has('ec2-frontend')).toBe(true);
    expect(serviceIds.has('ec2-backend')).toBe(true);
    for (const rule of challenge02.rules) {
      expect(rule.serviceId).not.toBe('ec2-frontend');
      expect(rule.serviceId).not.toBe('ec2-backend');
    }
  });

  it('includes distractor Services so the catalog tests judgement', () => {
    for (const distractor of ['lambda', 'eks', 'dynamodb', 'elasticache', 's3', 'ecr']) {
      expect(serviceIds.has(distractor)).toBe(true);
    }
  });

  it('gives every Service a display category', () => {
    for (const service of challenge02.services) {
      expect(service.category.trim().length).toBeGreaterThan(0);
      expect(service.name.trim().length).toBeGreaterThan(0);
    }
  });
});
