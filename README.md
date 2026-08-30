# architecture-canvas

An interactive AI/Web platform designed to help engineers, DevOps, DevSecOps, and future solution architects develop architectural thinking through hands-on challenge simulation.

## 🛠 Tech Stack & Architecture Overview

- **Frontend / Canvas UI:** React + TypeScript, built with Vite. Tailwind CSS for styling, [dnd-kit](https://dndkit.com/) for the nested drag-and-drop canvas.
- **Validation Engine:** Runs entirely client-side — the canvas tree is evaluated in the browser against the challenge's hardcoded rules. The MVP ships no backend service. See [`docs/adr/0001-client-side-validation-engine.md`](docs/adr/0001-client-side-validation-engine.md).
- **Containerization:** Docker & Docker Compose for zero-dependency local development and single-command deployment. The container serves a static production build via nginx.

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

---

## 📚 Documentation

| Document | Purpose |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Product vision and the problem being solved |
| [`MVP.md`](MVP.md) | MVP specification, Challenge #1, and acceptance criteria |
| [`CONTEXT.md`](CONTEXT.md) | Domain glossary — canonical vocabulary |
| [`docs/01-RESEARCH.md`](docs/01-RESEARCH.md) | Target audience, positioning, go-to-market |
| [`docs/02-PRODUCT-UX.md`](docs/02-PRODUCT-UX.md) | Settled UX and evaluation mechanics |
| [`docs/03-BACKLOG.md`](docs/03-BACKLOG.md) | Deferred / post-MVP ideas |
| [`docs/04-TECH-STACK.md`](docs/04-TECH-STACK.md) | Technical stack decisions and rationale |
| [`docs/adr/`](docs/adr/) | Architecture decision records |