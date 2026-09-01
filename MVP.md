# MVP Specification

## Goal

Create an MVP to bring the idea to life at a basic level. This will allow you to examine it from different angles, gather user feedback, and continue developing it while taking all necessary requirements into account.

## General Design
- website divided on 3 main vertical parts:
    - Requirements
    - Canvas
    - Services
- website have horizontal line as Header of the website
- Requirements
    - Challenge title and its description
    - visible Requirements
    - buttons that open Hidden Requirements (simulate communication with a client)
    - Score (added after submitting)
    - Evaluation (added after submitting)
- Services
    - list of blocks of Services divided by services categories
    - each Service represented by a square with the name
- Canvas
    - the bigest part of the website
    - dragged block placed here
    - Canvas uses a hierarchical Tree structure (nested containers). 
    - Services on the canvas interact via Parent-Child relationships
    - No explicit line connections/edges are required for this MVP phase. Validation logic relies strictly on checking parent-child node mappings.
- Header
    - Submit button

## User Flow
1. read Challenge description
2. push buttons to open Hidden Requirements
3. drag Service blocks and drop them on the Canvas
4. push Submit button
5. get Score and evaluation of its solution

## Challenges
In the beginning its going to be only 1 challenge that will be the main window. Other will be added later.

Each Challenge is authored as a file under [`docs/challenges/`](docs/challenges/), following [`docs/challenges/00-TEMPLATE.md`](docs/challenges/00-TEMPLATE.md), and encoded as a typed module in `src/challenges/`. The MVP ships one:

- [`docs/challenges/01-SIMPLE-WEB-APPLICATION.md`](docs/challenges/01-SIMPLE-WEB-APPLICATION.md) — Challenge #1, referenced throughout this document's Validation/Score/Evaluation sections below.

### Validation
- Validation function takes current Canvas JSON tree structure and compares it against the active Challenge's hardcoded rules array.
- Validation runs entirely client-side; there is no backend service.
- A rule requiring a service to be "inside" a container is satisfied only when that container is the service's *direct* parent.
- Rules are existential: a rule passes if at least one node satisfies it, and duplicate nodes neither help nor hurt.

## Score
- separate field with points earned
- added after submitting a Challenge
- 1 correct Rule score points = 100 / all Rules
- Points are summed at full precision and rounded only for display (e.g. 10 of 11 Rules → 91).
- The passed-Rule count is shown alongside the score (e.g. "91 — 10 of 11 requirements met").

## Evaluation
- separate field with evaluating solutions
- added after submitting a Challenge
- provide Recommendations about every failed evaluation Rule

## Out of Scope
- AI assistant
- Dynamic challenge generation
- Multiple challenges
- Multiple cloud providers
- Advanced architecture validation

## Acceptance Criteria

### Application
- [x] Application can be started locally.
- [x] Application can be deployed locally according to README instructions.
- [x] Challenge is displayed after opening the application.

### Requirements
- [x] Challenge title and description are displayed.
- [x] Visible requirements are displayed.
- [x] Hidden requirements are initially hidden.
- [x] Each hidden requirement can be revealed using a button.

### Services
- [x] Available services are displayed in the Services panel.
- [x] Services are grouped by category.
- [x] Services can be dragged onto the Canvas. *(see note)*

### Canvas
- [x] All services can be added, moved and removed from the Canvas.

### Submission
- [x] User can submit the architecture.
- [x] Score is calculated.
- [x] Evaluation is displayed.
- [x] User can see which requirements passed or failed.

### Evidence

Verified on 2026-08-30: **197 tests passing**, lint and typecheck clean, and
`docker compose up --build -d` serving a healthy container at `localhost:3000`
per the README instructions.

**One caveat, stated plainly.** "Services can be dragged onto the Canvas" is
the only criterion not backed by an automated end-to-end test. jsdom does not
produce the layout measurements dnd-kit needs, so simulating a drag would
exercise a mock rather than the application. What *is* covered: the
drop-to-reducer-action translation, every Canvas Tree operation, the
`KeyboardSensor` registration, and the focusability of every drag handle. The
pointer gesture itself rests on the dnd-kit wiring being correct and should be
confirmed with one manual pass in a browser — see the edge-case table in
`specs/001-architecture-canvas-mvp/quickstart.md`.
