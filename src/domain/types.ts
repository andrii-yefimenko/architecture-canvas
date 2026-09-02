/**
 * Domain types for Architecture Canvas.
 *
 * This module — and everything else under `src/domain/` and `src/challenges/` —
 * is framework-free by design. See ADR 0001: the evaluator is a pure function so
 * that relocating it server-side later is a transport change, not a rewrite.
 * The boundary is enforced by ESLint (`no-restricted-imports` / `-globals`).
 *
 * Vocabulary follows CONTEXT.md exactly: Service, Node, Canvas Tree, Challenge,
 * Rule, Evaluation, Recommendation, Score.
 */

// --- Identifiers -----------------------------------------------------------

/** Stable, hand-authored catalog key, e.g. "ec2-backend". Referenced by Rules. */
export type ServiceId = string;

/** Generated per placed Node via crypto.randomUUID(). Never authored by hand. */
export type NodeId = string;

/** Hidden Requirement Category key, e.g. "application-tier". */
export type CategoryId = string;

/** Rule key, e.g. "backend-in-private-subnet". */
export type RuleId = string;

// --- Service ---------------------------------------------------------------

/**
 * A catalog definition: a *type*, not a placed thing.
 *
 * A Service's type encodes its role — "EC2 (Frontend)" and "EC2 (Backend)" are
 * two distinct Services, not one configurable Service (FR-010). There is
 * deliberately no `isContainer` flag: any Node may contain any other (FR-012),
 * so containment is not a property of the Service.
 */
export interface Service {
  readonly id: ServiceId;
  readonly name: string;
  /** Display grouping in the Services panel, e.g. "Compute". */
  readonly category: string;
}

// --- Node and Canvas Tree --------------------------------------------------

/** A placed instance of a Service. Parenthood is positional, not a field. */
export interface Node {
  readonly id: NodeId;
  readonly serviceId: ServiceId;
  readonly children: readonly Node[];
}

/**
 * The nested hierarchy of Nodes — the Evaluation's input and the unit of
 * persistence.
 *
 * A forest rather than a single root: a Service dropped on empty Canvas becomes
 * a root-level Node, and the user may create several before nesting them.
 *
 * Invariants (enforced by canvas-tree.ts):
 *  1. Every NodeId appears at most once.
 *  2. Acyclic — no Node appears within its own subtree.
 *  3. Every serviceId resolves against the current Challenge catalog.
 */
export interface CanvasTree {
  readonly roots: readonly Node[];
}

// --- Requirements ----------------------------------------------------------

/**
 * A named group of Hidden Requirements revealed together as a unit — the
 * interview question the user chooses to ask (FR-004, FR-005).
 */
export interface HiddenRequirementCategory {
  readonly id: CategoryId;
  readonly name: string;
  readonly requirements: readonly string[];
}

// --- Rule ------------------------------------------------------------------

interface RuleBase {
  readonly id: RuleId;
  /** Human-readable statement of the condition, shown in the Evaluation. */
  readonly description: string;
  /** Shown when the Rule fails: the corrective action and its reasoning. */
  readonly recommendation: string;
}

/** Passes when at least one Node in the tree has this serviceId. */
export interface PresenceRule extends RuleBase {
  readonly kind: 'presence';
  readonly serviceId: ServiceId;
}

/**
 * Passes when at least one Node with `serviceId` has a **direct** parent whose
 * serviceId is `parentServiceId` (FR-021). A Node nested one level deeper does
 * not satisfy the Rule.
 */
export interface ContainmentRule extends RuleBase {
  readonly kind: 'containment';
  readonly serviceId: ServiceId;
  readonly parentServiceId: ServiceId;
}

/**
 * A discriminated union rather than one shape with optional fields, so the
 * evaluator's exhaustiveness is compile-time checked and `parentServiceId`
 * cannot be omitted from a containment Rule.
 *
 * Both kinds are existential: additional non-satisfying Nodes never cause a
 * failure (FR-022).
 */
export type Rule = PresenceRule | ContainmentRule;

// --- Challenge -------------------------------------------------------------

/** Shown on a Challenge's Catalog Page card. Set per Challenge, not computed. */
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface Challenge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Shown on load, without user action (FR-002). */
  readonly visibleRequirements: readonly string[];
  /** Concealed on load (FR-003). */
  readonly hiddenRequirementCategories: readonly HiddenRequirementCategory[];
  readonly services: readonly Service[];
  readonly rules: readonly Rule[];
  /** Shown on the Catalog Page card. Presentational only; never evaluated. */
  readonly difficulty: Difficulty;
  /** Shown on the Catalog Page card. Presentational only; not used for filtering. */
  readonly tags: readonly string[];
  /**
   * One or two sentences for the Catalog Page card — distinct from
   * `description`, which is the full brief shown on the Task Page.
   */
  readonly shortDescription: string;
}

// --- Evaluation ------------------------------------------------------------

export interface RuleResult {
  readonly ruleId: RuleId;
  readonly passed: boolean;
}

/**
 * The result of running every Rule against the Canvas Tree. Never persisted
 * (FR-034).
 *
 * `results` covers every Rule, passing or failing, so the UI renders a complete
 * checklist (FR-023). Descriptions and Recommendations are looked up from the
 * Challenge by ruleId rather than copied here, keeping one source of truth.
 */
export interface Evaluation {
  readonly results: readonly RuleResult[];
  readonly passedCount: number;
  readonly totalCount: number;
  /** Full float precision; rounded only at render (FR-027). */
  readonly score: number;
}
