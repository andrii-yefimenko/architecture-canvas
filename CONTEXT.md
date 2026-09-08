# Domain Glossary

Canonical vocabulary for Architecture Canvas. Use these terms exactly — in code, issues, commits, tests, and docs. Where a term has common synonyms that this project deliberately avoids, they're listed so the drift doesn't creep back.

## Service

A definition in the challenge's catalog, shown in the Services panel and available to drag onto the Canvas — for example "EC2 (Backend)", "Public Subnet", "RDS". A Service is a *type*, not a thing on the canvas.

A Service's type carries its role: "EC2 (Frontend)" and "EC2 (Backend)" are two distinct Services, not one Service with a configurable role.

*Avoid:* "block", "component", "resource".

## Node

An instance of a Service placed on the Canvas. A Node has its own identity, a parent, and children. Several Nodes may share the same Service type.

*Avoid:* "block", "element", "item".

## Frame

The on-canvas rendering of a Node as a resizable container, auto-sized to enclose its children. Any Node with at least one child renders as a Frame, regardless of its Service's default appearance — an EC2 that gains a child is drawn the same way a VPC is.

*Avoid:* "container" (reserved for this domain's actual AWS/Docker sense — ECS, Fargate, "Containerized Web Application" — never for this rendering concept), "block".

## Card

The on-canvas rendering of a Node as a compact, fixed-size square — the default appearance for a Service like EC2, RDS, or ALB. Applies only while the Node has no children; a Card that gains a child becomes a Frame.

*Avoid:* "block".

## Layout

A Node's position and size on the Canvas — `{x, y, width, height}`. Kept separately from the Canvas Tree: Layout is presentation data no Rule ever evaluates, but it's persisted alongside the Canvas Tree per Challenge.

*Avoid:* "position" (implies x/y only, omits size), "placement".

## Canvas Tree

The nested hierarchy of Nodes. This is the evaluator's input. Persisted between sessions alongside each Node's Layout, though Layout itself carries no weight in Evaluation. Relationships in the Canvas Tree are strictly parent-child; there are no edges or connections.

*Avoid:* "diagram", "graph", "architecture" (when meaning the data structure).

## Challenge

A single exercise: title, description, Visible Requirements, Hidden Requirements, its Service catalog, and its Rules. Every Challenge in the app is defined this way; see Challenge Registry for the full set.

## Difficulty

A short label on a Challenge — Beginner / Intermediate / Advanced — shown on its Catalog Page card. Set per Challenge; not derived or computed.

## Tags

Free-form labels on a Challenge (e.g. "AWS", "Containers") shown on its Catalog Page card, letting a user scan for one matching what they want to practice. Not used for filtering in the MVP.

## Challenge ID

The stable identifier for a Challenge — used in the Challenge Registry, in routing (`/challenge/:id`), and to scope that Challenge's persisted state. Distinct from a Challenge's title, which is display text and may change without affecting the ID.

## Challenge Registry

The ordered list of every Challenge available in the app. Backs the Catalog Page. Registry order is authorial — the order Challenges are defined in, not sorted or computed.

*Avoid:* "challenge list" as a code or doc identifier — "Registry" is the canonical term because it also implies the lookup-by-Challenge-ID contract.

## Catalog Page

The landing page listing every Challenge in the Challenge Registry as a card (title, difficulty, short description, tags, and a Start Challenge button). Entry point to a Task Page. See `docs/pages-ux/02-CATALOG-PAGE.md`.

## Task Page

The page where a user works a single Challenge — the three-panel layout (Requirements, Canvas, Services) plus Header described in `MVP.md`'s General Design and `docs/pages-ux/01-TASK-PAGE.md`. Reached via the Catalog Page's Start Challenge button, at `/challenge/:id`.

## Visible Requirement

A requirement shown to the user immediately, before any interaction.

## Hidden Requirement

A requirement withheld until the user asks for it, simulating a client who has to be interviewed. Hidden Requirements are grouped into **Hidden Requirement Categories** — reveal groups defined per Challenge (Challenge #1 uses four: Infrastructure, Presentation Tier, Application Tier, Data Tier; other Challenges define their own set and naming). The user reveals a whole Category at a time, never an individual Hidden Requirement.

## Rule

One checkable condition in a Challenge, evaluated against the Canvas Tree — for example "EC2 (Backend) must be inside a Private Subnet". A Rule either passes or fails; there is no partial result.

*Avoid:* "evaluation rule", "rules array", "check", "checklist item", "validation rule". It is a Rule.

## Evaluation

The result of running every Rule in a Challenge against the Canvas Tree. An Evaluation reports each Rule's pass/fail state and carries a Recommendation for each failed Rule. Produced by submitting; the user may submit any number of times.

## Recommendation

The guidance attached to a failed Rule, telling the user what to change and why.

## Score

The number derived from an Evaluation: the count of passed Rules over the total, expressed out of 100.
