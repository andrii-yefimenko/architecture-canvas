/**
 * Referential-integrity guards for authored Challenge data.
 *
 * These exist to catch authoring mistakes at test time rather than as a
 * silently wrong Score at runtime — the exact defect class the documentation
 * audit found in prose ("Backend EC2" vs "EC2 (Backend)").
 * See contracts/challenge.md.
 */

import { challenge01 } from './challenge-01';

const serviceIds = new Set(challenge01.services.map((s) => s.id));

describe('identifier uniqueness', () => {
  it('has unique Service ids', () => {
    expect(serviceIds.size).toBe(challenge01.services.length);
  });

  it('has unique Rule ids', () => {
    const ids = new Set(challenge01.rules.map((r) => r.id));
    expect(ids.size).toBe(challenge01.rules.length);
  });

  it('has unique Hidden Requirement Category ids', () => {
    const ids = new Set(challenge01.hiddenRequirementCategories.map((c) => c.id));
    expect(ids.size).toBe(challenge01.hiddenRequirementCategories.length);
  });
});

describe('Rule references resolve to the Service catalog', () => {
  it.each(challenge01.rules.map((r) => [r.id, r.serviceId] as const))(
    'Rule %s references a known serviceId (%s)',
    (_ruleId, serviceId) => {
      expect(serviceIds.has(serviceId)).toBe(true);
    },
  );

  it('every containment Rule references a known parentServiceId', () => {
    for (const rule of challenge01.rules) {
      if (rule.kind === 'containment') {
        expect(serviceIds.has(rule.parentServiceId)).toBe(true);
      }
    }
  });
});

describe('content completeness', () => {
  it('every Rule has a non-empty description and recommendation', () => {
    for (const rule of challenge01.rules) {
      expect(rule.description.trim().length).toBeGreaterThan(0);
      expect(rule.recommendation.trim().length).toBeGreaterThan(0);
    }
  });

  it('every Recommendation is more than a restatement of its description', () => {
    // SC-003 requires a specific corrective action, not just "this failed".
    for (const rule of challenge01.rules) {
      expect(rule.recommendation).not.toBe(rule.description);
      expect(rule.recommendation.length).toBeGreaterThan(rule.description.length);
    }
  });

  it('has non-empty visible requirements', () => {
    expect(challenge01.visibleRequirements.length).toBeGreaterThan(0);
  });

  it('every Category has at least one requirement', () => {
    for (const category of challenge01.hiddenRequirementCategories) {
      expect(category.requirements.length).toBeGreaterThan(0);
    }
  });

  it('has a title and description', () => {
    expect(challenge01.title.trim().length).toBeGreaterThan(0);
    expect(challenge01.description.trim().length).toBeGreaterThan(0);
  });
});

describe('Challenge #1 shape, per MVP.md', () => {
  it('has exactly 11 Rules', () => {
    expect(challenge01.rules).toHaveLength(11);
  });

  it('has exactly 4 Hidden Requirement Categories', () => {
    expect(challenge01.hiddenRequirementCategories.map((c) => c.name)).toEqual([
      'Infrastructure',
      'Presentation Tier (Web / Frontend)',
      'Application Tier (Backend Logic)',
      'Data Tier (Database)',
    ]);
  });

  it('lists the Rules in MVP.md order', () => {
    expect(challenge01.rules.map((r) => r.id)).toEqual([
      'vpc-exists',
      'public-subnet-in-vpc',
      'private-subnet-in-vpc',
      'internet-gateway-in-vpc',
      'nat-gateway-in-public-subnet',
      'ec2-frontend-present',
      'ec2-frontend-in-public-subnet',
      'rds-present',
      'ec2-backend-present',
      'ec2-backend-in-private-subnet',
      'rds-in-private-subnet',
    ]);
  });

  it('models the two EC2 roles as distinct Services (FR-010)', () => {
    expect(serviceIds.has('ec2-frontend')).toBe(true);
    expect(serviceIds.has('ec2-backend')).toBe(true);
    expect(serviceIds.has('ec2')).toBe(false);
  });

  it('includes distractor Services so the catalog tests judgement', () => {
    for (const distractor of ['lambda', 'aurora', 'dynamodb', 's3', 'cloudfront', 'eks']) {
      expect(serviceIds.has(distractor)).toBe(true);
    }
  });

  it('gives every Service a display category', () => {
    for (const service of challenge01.services) {
      expect(service.category.trim().length).toBeGreaterThan(0);
      expect(service.name.trim().length).toBeGreaterThan(0);
    }
  });
});
