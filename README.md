# architecture-canvas

An interactive platform that helps engineers, DevOps, DevSecOps, and future solution architects develop **architectural thinking** — not just lab-exercise muscle memory.

Most cloud training hands you a finished design and asks you to click through it. Architecture Canvas gives you an ambiguous brief, makes you interview the client for the requirements they didn't mention, and then reviews the architecture you actually designed.

## How it works

1. **Pick a Challenge.** The Catalog lists every exercise available — title, difficulty, and a one-line summary of what it's testing.
2. **Read the brief.** You get a business situation and a handful of visible requirements — not the full picture.
3. **Ask the client.** The rest of the requirements are hidden behind a handful of topic areas specific to that Challenge. Reveal them a topic at a time, the way you would interview a real stakeholder. There is no score penalty for asking.
4. **Design.** Drag Services onto the Canvas and nest them to express your architecture. Nothing is blocked — you can place anything anywhere, including arrangements that make no sense.
5. **Submit.** Your Canvas Tree is checked against the challenge's Rules. You get a Score, a pass/fail line for **every** requirement, and a specific recommendation for each failure.
6. **Revise.** Fix what failed and submit again, as many times as you like. Your previous results stay on screen while you work.

Your in-progress work is saved in the browser per Challenge, so an accidental refresh doesn't lose it. Leaving via **Back to Catalog** clears it on purpose — persistence is a safety net, not a resume-later feature.

## 🛠 Tech Stack & Architecture Overview

- **Frontend / Canvas UI:** React 18 + TypeScript, built with Vite. Tailwind CSS for styling, [dnd-kit](https://dndkit.com/) for the nested drag-and-drop canvas.
- **Validation Engine:** Runs entirely client-side — the Canvas Tree is evaluated in the browser against the challenge's Rules. There is no backend service. See [`docs/adr/0001-client-side-validation-engine.md`](docs/adr/0001-client-side-validation-engine.md).
- **State:** `useReducer` + Context. No external state library.
- **Testing:** Vitest + React Testing Library.
- **Containerization:** Docker & Docker Compose for zero-dependency local development and single-command deployment. The container serves a static production build via nginx.

### Design principle: the domain layer is framework-free

`src/domain/` and `src/challenges/` contain pure TypeScript with no React, no dnd-kit, and no browser APIs. `evaluate(canvasTree, rules) → Evaluation` is a pure function.

This is what keeps the client-side evaluator from being a dead end: moving it behind an API later is a transport change, not a rewrite. The boundary is enforced by ESLint *and* by an architectural test, because it is easy to break by accident and nothing else would notice.

---

## 🚀 Quick Start (Local Development via Docker)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.0+)

### Running the Application

1. **Clone the repository:**
   ```bash
   git clone https://github.com/andrii-yefimenko/architecture-canvas.git
   cd architecture-canvas
   ```
2. Build and start the application:
   ```bash
   docker compose up --build -d
   ```
3. Access the platform:
   Open your browser and navigate to: http://localhost:3000

   To stop it: `docker compose down`

---

## 💻 Local Development (without Docker)

Requires **Node.js 20+**.

```bash
npm install
npm run dev          # dev server at http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck, then build the production bundle |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Watch mode — the loop for domain work |
| `npm run test:ui` | Vitest UI |
| `npm run lint` | ESLint, including the domain-purity rules |
| `npm run format` | Prettier |

## 🗂 Project Structure

```text
src/
├── domain/          # Pure TypeScript. No React, no storage, no browser APIs.
│   ├── types.ts     # Service, Node, CanvasTree, Challenge, Rule, Evaluation
│   ├── canvas-tree.ts  # Tree operations, including the cycle guard
│   ├── evaluator.ts    # evaluate(canvasTree, rules) -> Evaluation
│   └── score.ts
├── challenges/      # Authored challenge data + the Challenge Registry (also framework-free)
├── routing/         # useRoute() — the app's two-route client-side router
├── state/           # Reducer, Context provider, per-Challenge persistence
├── pages/           # CatalogPage, TaskPage
└── components/      # React: header, catalog, requirements, canvas, services

tests/
├── architecture/    # Guards: domain purity, terminology, keyboard access
└── integration/     # One suite per user story
```

## 📚 Documentation

| Document | Purpose |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Product vision and the problem being solved |
| [`MVP.md`](MVP.md) | MVP specification and acceptance criteria |
| [`CONTEXT.md`](CONTEXT.md) | Domain glossary — canonical vocabulary |
| [`docs/01-RESEARCH.md`](docs/01-RESEARCH.md) | Target audience, positioning, go-to-market |
| [`docs/pages-ux/01-TASK-PAGE.md`](docs/pages-ux/01-TASK-PAGE.md) | Task Page — settled UX and evaluation mechanics |
| [`docs/pages-ux/02-CATALOG-PAGE.md`](docs/pages-ux/02-CATALOG-PAGE.md) | Catalog Page — challenge list UX |
| [`docs/challenges/`](docs/challenges/) | Per-challenge specs (template + Challenges #1 and #2) |
| [`docs/03-BACKLOG.md`](docs/03-BACKLOG.md) | Deferred / post-MVP ideas, and current scope beyond the frozen MVP |
| [`docs/04-TECH-STACK.md`](docs/04-TECH-STACK.md) | Technical stack decisions and rationale |
| [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`specs/001-architecture-canvas-mvp/`](specs/001-architecture-canvas-mvp/) | v0.1.0 MVP: specification, plan, contracts, and task breakdown (frozen) |
| [`specs/002-multi-challenge-catalog/`](specs/002-multi-challenge-catalog/) | Multi-Challenge Catalog & Challenge #2: specification, plan, contracts, and task breakdown |

## Scope

Two Challenges ship today — **Simple Web Application** and **Containerized Microservice** — browsable from the Catalog. There's still no AI: the client chat and AI architecture reviewer described in [`PROJECT.md`](PROJECT.md) remain future work, along with multiple cloud providers — see [`docs/03-BACKLOG.md`](docs/03-BACKLOG.md). `MVP.md` is kept as the frozen record of the original single-Challenge v0.1.0 release.
