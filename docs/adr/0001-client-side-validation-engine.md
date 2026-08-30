# 0001 — Client-side validation engine

**Status:** Accepted
**Date:** 2026-08-30

## Context

`MVP.md` describes validation as "a validation function [that] takes current Canvas JSON tree structure and compares it against hardcoded Challenge #1 rules array" — but never says where that function runs. Meanwhile `README.md` listed a "Backend / Validation Engine" as an architectural component and prescribed a Docker Compose setup, implying a multi-service deployment, while `docs/02-PRODUCT-UX.md` specified `localStorage` persistence with "no backend involved."

A cross-document audit surfaced this as a direct contradiction. It had to be resolved before writing the specification, because nearly every downstream decision — deployment topology, persistence, testing strategy, task breakdown — depends on the answer.

The tension is real. `PROJECT.md`'s future product centers on an AI chat that simulates a client and an AI reviewer that critiques submitted architectures. Both need a server, because neither can ship API credentials to a browser. Choosing no backend now means adding one later.

## Decision

The MVP is a frontend-only single-page application. The validation engine runs in the browser: a pure function taking the Canvas Tree and the Challenge's Rules, returning an Evaluation. No backend service, no API, no database. The Docker container serves a static build.

## Consequences

**Accepted cost — the rules are visible to a determined user.** The Rules ship in the JavaScript bundle, so anyone opening devtools can read the expected architecture and score full marks without reasoning about it. This is acceptable: per `docs/01-RESEARCH.md` the audience is practitioners with an on-the-job skill gap, self-motivated and with nothing to gain from cheating themselves. There is no credential, certificate, or ranking attached to a Score. Were the platform later used for hiring assessment — listed as a non-target audience — this calculus would change and would justify revisiting the decision.

**Positive.** Radically simpler to build, deploy, and reason about. No server, no auth, no persistence layer, no network error states in the submit flow. The evaluator being a pure function is what makes the testing strategy in `docs/04-TECH-STACK.md` cheap and exhaustive. Deployment is a static bundle, so hosting is nearly free during the build-in-public phase.

**The AI layer will require revisiting this.** The AI client chat and AI review from `PROJECT.md` §4 both need server-side API calls. That work introduces a backend regardless of what is decided here, so the question is only whether to pay for it now or then. Paying now would mean building infrastructure with no current use.

**Migration path.** Because the evaluator is a pure function over `(CanvasTree, Rule[]) → Evaluation`, moving it server-side later is a transport change, not a rewrite: the same function runs behind an endpoint, and the client posts the tree instead of evaluating it locally. Keeping that signature clean is the thing to protect.
