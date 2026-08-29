# Architecture Canvas — Product, Market & Business Research

Source of truth referenced: `PROJECT.md`, `MVP.md`, `README.md`.
Compiled from a brainstorming session on 2026-08-29.

## 1. Target Audience

**Primary segment: Individual upskillers — practitioners leveling up.**

- **Who:** Cloud engineers, DevOps/DevSecOps engineers, and backend developers who already work hands-on with individual cloud services day-to-day, but have never had to design a full system end-to-end.
- **Not the primary target (for now):** Absolute beginners with no cloud experience, corporate L&D buyers, bootcamps/universities, and hiring/assessment use cases. These may become secondary audiences later, but the MVP and initial positioning should not be diluted trying to serve them all at once.
- **Core motivation:** An **on-the-job skill gap**, not exam prep. Their current role increasingly demands architecture-level decisions (trade-offs, requirements gathering, justifying design choices), but their experience so far has been executing tickets against someone else's design. They have no safe, repeatable place to practice the reasoning itself.
- **Implication for design:** Copy, challenge framing, and onboarding should speak to "you already know the services — this is where you learn to *decide*," not "learn AWS from scratch." Challenges should simulate ambiguous, incomplete real-world requirements (as MVP.md already does with hidden requirements) rather than clean, fully-specified problems — that ambiguity is the actual skill gap being addressed.

## 2. Market Positioning & Competitor Analysis

**Positioning anchor: closest to system-design-interview-prep tools** (Exponent, ByteByteGo, Educative's "Grokking the System Design Interview," DesignGurus), not cloud lab platforms or generic diagramming tools — though it borrows from both.

### Core differentiators vs. system-design-interview prep

1. **Hidden-requirement discovery that simulates real client conversations.** Interview-prep platforms hand you the full problem statement upfront and evaluate your talking-through-it performance (via mock interviewer or static rubric). Architecture Canvas instead hides requirements behind a simulated client chat — training the requirements-gathering and clarifying-questions skill that these platforms skip entirely, and that is arguably the harder, more realistic part of an architect's job.
2. **An interactive sandbox you actually build in, not a whiteboard or a video.** Interview-prep content is largely passive (courses, videos, mock interview transcripts) or freeform whiteboarding. Architecture Canvas gives a real drag-and-drop, constraint-aware canvas (parent/child placement, real service names, real infrastructure rules) so the "answer" is a concrete, checkable artifact — closer to a flight simulator than a study guide.
3. **Instant, automated, rule-based evaluation** (secondary but reinforcing point): no need to schedule a mock interviewer or wait on community feedback — score and per-rule recommendations are immediate and repeatable.

### Competitive landscape

| Category | Examples | Pricing (as of 2026) | Gap Architecture Canvas fills |
|---|---|---|---|
| System design interview prep | Exponent, ByteByteGo, Educative (Grokking the System Design Interview), DesignGurus | Exponent ~$12–79/mo; Educative ~$14–17/mo; DesignGurus course bundles frequently discounted 55–60% | These are interview-outcome-focused (get hired) and largely passive/text/video. None offer a hands-on canvas where you place real services under real constraints and get instant structural feedback. |
| Hands-on cloud labs | A Cloud Guru (Pluralsight), KodeKloud, Qwiklabs / Google Cloud Skill Boost | A Cloud Guru ~$49/mo; KodeKloud ~$20/mo; Qwiklabs credit-based | These teach you to *execute* a given architecture (step-by-step lab tasks), not to *design* one from ambiguous requirements. No open-ended design or trade-off evaluation. |
| Diagramming tools | Lucidchart, draw.io, CloudCraft | Free–$10s/mo | Good for drawing, zero learning/evaluation layer. Not a competitor so much as a component Architecture Canvas replaces with a purpose-built, constraint-validated canvas. |

**Takeaway:** There is no direct competitor doing "hidden-requirement discovery + real-service drag-and-drop canvas + automated architectural review" as one loop. The category is adjacent-but-open: interview-prep owns "talk about design," cloud labs own "execute a given design," and Architecture Canvas owns "gather ambiguous requirements, then design and defend a solution." Pricing in both adjacent categories ($12–49/mo) suggests users are already accustomed to paying for structured practice, which supports a freemium model rather than needing to prove people will pay at all.

## 3. Go-To-Market & Growth Strategy

**Phase 1 — Narrow, personal, feedback-driven (current focus).**
- Channel: LinkedIn / personal-brand build-in-public. Share progress, challenge previews, and early user results directly rather than posting into broad developer communities (Reddit, Discord) or pursuing cert-prep influencer partnerships at this stage.
- Goal of this phase is **not** growth — it's tight feedback from a small, trusted audience to validate and refine the product (UX of the canvas, difficulty/clarity of hidden requirements, whether the evaluation feels fair and useful) before wider exposure.

**Phase 2 — Widen distribution.**
Triggered by **both** of the following (not either/or):
- **Feature completeness milestone:** the AI layer from the future-product vision (AI client chat for hidden requirements, AI-driven review/suggestions) is live — not just the static, hardcoded-rules MVP. This is the point at which the product's real differentiation (vs. static rule-checking) becomes visible to a first-time user.
- **Content library size:** enough challenges exist (rough target: 5–10) that a newly-arrived user doesn't churn out immediately after completing the single available challenge.

Only once both conditions are met should distribution widen into broader developer communities, content/SEO, or influencer/affiliate channels — those were explicitly deferred rather than ruled out.

## 4. Business Model

**Freemium.** Free access to a limited set of challenges (e.g., Challenge #1) to drive adoption and word-of-mouth during the narrow build-in-public phase; a paid tier gates the full challenge library and/or the future AI chat and AI review features once built. No B2B/team-seat model or one-time-purchase bundle for now — those remain open for later once individual product-market fit is validated.

---

### Open questions / not yet decided
- Exact price point and feature split for the paid tier (deferred until AI features and challenge library exist).
- Whether corporate L&D, bootcamps, or hiring/assessment use cases become secondary audiences later — explicitly deprioritized for now, not ruled out.

### Sources consulted
- [Top 7 ByteByteGo Alternatives for System Design Interviews (2026 Guide)](https://medium.com/javarevisited/top-7-bytebytego-alternatives-for-system-design-interviews-2026-guide-56e5b8b7287f)
- [I Tried ByteByteGo, NeetCode, and Educative — 2026](https://medium.com/javarevisited/i-tried-bytebytego-neetcode-and-educative-heres-which-one-actually-delivers-for-system-design-be2a9e1b2b74)
- [Compare A Cloud Guru vs. KodeKloud vs. Qwiklabs in 2026](https://slashdot.org/software/comparison/A-Cloud-Guru-vs-KodeKloud-vs-Qwiklabs/)
- [KodeKloud Pricing & Subscription Plans](https://kodekloud.com/pricing)
- [Hands-on AWS Labs vs Skill Builder vs A Cloud Guru (2026)](https://www.cloudarena.io/blog/hands-on-aws-labs-vs-aws-skill-builder-vs-a-cloud-guru)
