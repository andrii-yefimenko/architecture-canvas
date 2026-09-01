# Challenge Template

Copy this file to `docs/challenges/NN-SHORT-NAME.md` when authoring a new Challenge, where `NN` is the next Registry sequence number. Fill in every section — an empty section is a sign the Challenge isn't ready to implement. Once written up here, encode it as a typed Challenge module in `src/challenges/` (see `challenge-01.ts` for the existing shape).

## Metadata

- **Challenge ID**: `challenge-NN` — the stable identifier used in the Challenge Registry, in routing (`/challenge/:id`), and in the per-Challenge persistence key.
- **Title**: Short, human-readable name shown on the Catalog Page card and the Task Page header.
- **Difficulty**: Beginner / Intermediate / Advanced.
- **Tags**: Free-form labels for the Catalog Page card (topic, scope, technology focus).
- **Short description**: One or two sentences for the Catalog Page card.

## Description

The full business situation shown on the Task Page — the scenario the user is designing for. Should read like a brief, not a spec: ambiguous enough that Hidden Requirements are genuinely needed.

## Visible Requirements

The requirements shown immediately, before any interaction. Keep this list short enough to leave real gaps for Hidden Requirements to fill.

## Hidden Requirements

Grouped into Hidden Requirement Categories — the reveal groups shown as buttons on the Task Page. Each Category should be a plausible topic a real stakeholder interview would surface (e.g. "Infrastructure," "Security," "Cost").

### Category Name

- Requirement bullet.
- Requirement bullet.

## Available Services

The Challenge's Service catalog, grouped by category, as shown in the Services panel. Include enough distractor Services (correct-sounding but wrong for this Challenge) that the Challenge tests judgment, not just recognition of the "obviously right" answer.

## Required Architecture

The target Canvas Tree — the nested structure a fully-correct solution produces. Written as an indented tree, matching the format in `01-SIMPLE-WEB-APPLICATION.md`.

## Evaluation Rules

A numbered list of Rules, each independently checkable against the Canvas Tree. Follow the two fixed evaluation semantics from `docs/pages-ux/01-TASK-PAGE.md`: "inside" means direct-child-only, and Rules are existential (duplicates neither help nor hurt). Number them in the order they should be checked and displayed.

1. Rule text.
2. Rule text.

### Failure Example

At least one worked example of a failing Rule, in Requirement / Result / Recommendation form, to pressure-test that the Rule's Recommendation text is actually useful advice.

- Requirement: …
- Result: Failed.
- Recommendation: …
