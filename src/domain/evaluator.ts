/**
 * The rule evaluator — the most important interface in the project.
 *
 * Two arguments in, one value out: no React, no storage, no clock, no
 * randomness. That purity is what makes it exhaustively testable without
 * rendering, and what makes ADR 0001's migration path real — relocating
 * evaluation behind an endpoint later is a transport change, because this same
 * function runs unmodified on either side.
 *
 * Any change that adds a side effect, a framework import, or a dependency on
 * component state breaks that. See contracts/evaluator.md.
 */

import { computeScore } from './score';
import type { CanvasTree, Evaluation, Node, Rule, RuleResult, ServiceId } from './types';

/** Every (node, directParentServiceId) pair in the tree. Parent is null at root. */
function collectPlacements(tree: CanvasTree): { serviceId: ServiceId; parent: ServiceId | null }[] {
  const placements: { serviceId: ServiceId; parent: ServiceId | null }[] = [];

  const visit = (nodes: readonly Node[], parent: ServiceId | null): void => {
    for (const node of nodes) {
      placements.push({ serviceId: node.serviceId, parent });
      visit(node.children, node.serviceId);
    }
  };

  visit(tree.roots, null);
  return placements;
}

function evaluateRule(
  rule: Rule,
  placements: readonly { serviceId: ServiceId; parent: ServiceId | null }[],
): boolean {
  switch (rule.kind) {
    // Existential: one matching Node anywhere in the tree is enough (FR-022).
    case 'presence':
      return placements.some((p) => p.serviceId === rule.serviceId);

    // Existential AND direct-parent-only: a Node nested one level deeper does
    // not satisfy the Rule (FR-021).
    case 'containment':
      return placements.some(
        (p) => p.serviceId === rule.serviceId && p.parent === rule.parentServiceId,
      );

    default: {
      const exhaustive: never = rule;
      return exhaustive;
    }
  }
}

/**
 * Evaluates the Canvas Tree against every Rule.
 *
 * Total: never throws, for any input including an empty tree or an empty rule
 * set. Complete: returns one RuleResult per Rule, in Rule order, so the UI can
 * render a full pass/fail checklist rather than failures alone (FR-023).
 *
 * Rule descriptions and Recommendations are deliberately NOT copied into the
 * result — the UI resolves them from the Challenge by ruleId, keeping one
 * source of truth for that text.
 */
export function evaluate(canvasTree: CanvasTree, rules: readonly Rule[]): Evaluation {
  const placements = collectPlacements(canvasTree);

  const results: RuleResult[] = rules.map((rule) => ({
    ruleId: rule.id,
    passed: evaluateRule(rule, placements),
  }));

  const passedCount = results.filter((r) => r.passed).length;

  return {
    results,
    passedCount,
    totalCount: results.length,
    score: computeScore(passedCount, results.length),
  };
}
