# Plan

How to read and update this repo's roadmap and Decision Log, kept in `docs/02-PLAN.md`.

## Before touching it, read it in full

`docs/02-PLAN.md` is short. Read the whole file, not one section, before adding to it — a new Decision Log entry or milestone update needs to see what's already there to avoid duplicating an existing entry or contradicting a stated Guiding Principle.

## Structure

- **§1 Guiding Principles & Hard Constraints**: the invariants (Domain Purity, Minimal Dependencies, Additive Evolution, Data Isolation). Edit only when a new invariant is decided in a Brainstorm/Grill session — not per feature, and never silently: if work you're doing would violate one, stop and flag it rather than editing the principle to fit.
- **§2 Milestone Roadmap**: versioned feature groups (Completed / Current Focus / Future). One block per version; bullets are shipped capabilities, not tasks.
- **§3 Decision Log & Conventions**: dated, terse entries recording settled architecture and convention decisions. See Decision Capture below.
- **§4 Backlog**: a pointer only. Deferred ideas live in `docs/03-BACKLOG.md`; never duplicate backlog items into `docs/02-PLAN.md`.

## Decision Capture

When a Brainstorm/Grill session reaches a conclusion:

1. **Judge ADR-worthiness**: hard to reverse, surprising without context, and the result of a real trade-off between genuine alternatives — the bar `mattpocock-skills:domain-modeling` already applies. If any of the three is missing, skip the ADR.
2. **If ADR-worthy**: create `docs/adr/NNNN-<kebab-slug>.md`, numbered one past the highest existing `docs/adr/NNNN-*.md`, then add one §3 entry linking it by ID — a one-line summary plus the file path, not the reasoning again.
3. **If not ADR-worthy**: add the entry directly to §3.
4. **Writing the §3 entry**: match the existing entries' density — one paragraph, bold lead term naming the decision, cite verbatim evidence (file paths, key formats, constants, rule names). Link to `docs/pages-ux/*.md` or other settled specs instead of restating them.

Done when the entry cites evidence you re-checked against current code or docs — not evidence recalled from earlier in the conversation.

## Milestone state transitions

- **Future → Current Focus**: promote only after a Brainstorm/Grill conclusion already exists as a Decision Log entry or ADR — the roadmap line should follow the record, not precede it.
- **Current Focus → Completed**: mark Completed only once verified end-to-end (tests passing), not once code merges. Cite a test count when it's easy to state, matching this repo's existing practice.

## Execution

Once a milestone or backlog item is ready to build, hand off to the SpecKit skill chain (`speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`), which owns `specs/<feature>/`. `docs/02-PLAN.md` records the decision to build something and its shipped state — it does not hold specs, tasks, or implementation detail.
