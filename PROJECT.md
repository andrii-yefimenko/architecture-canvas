# architecture-canvas

## 1. Project Idea

An AI Web Platform for Training Cloud & Security and other Architecture Skills.
I want to design a web platform that helps engineers, DevOps professionals, DevSecOps professionals, cloud engineers, and future solution/security architects develop their architectural thinking — not just complete lab exercises.

## 2. Problem it solves

A lot of exercises on other platforms are just, do tasks for prepared architecture. In result, students don't thinking how  all of this solutions work together, and why those decisions were made. So they mainly learn how to use individual services or replicate existing architectures.

## 3. Impact 

I want to create a platform that simulates the real-world work of an architect: gathering requirements; clarifying the business context; designing infrastructure; making trade-offs; analyzing risks; and conducting architectural reviews.

## 4. Future Product 

- There is a set of challenges with different requirements. 
- At first, only the main part of requirement for specific task is shown.
- There is an AI chat that simulates communication with a client, where you can find out more detailed information (this information was initially specified but hidden).
- After receiving the task, you move on to creating the architecture. This is a no-code drag-and-drop interface where you draw the architecture and specify some basic required parameters.
- The UI is as user-friendly as possible and not cluttered.
- Once the architecture is ready, you submit it for review by the AI, which compares it to the static data and also provides suggestions on how it should be modified, what best practices to follow, and why certain aspects are incorrect.

> **Note:** This section describes the *future* product, not the MVP. In particular, "specify some basic required parameters" is a future capability — in the MVP a service's type is its role (e.g. "EC2 (Frontend)" and "EC2 (Backend)" are distinct catalog entries), and there is no post-drop configuration step. See `docs/02-PRODUCT-UX.md`.

## 5. MVP 

Right now, MVP has no AI at all and no additionals features, so as not to overload the code and to focus on identifying problems and finding ways to solve them.

The MVP is a frontend-only single-page application: the architecture is evaluated client-side against hardcoded rules, with no backend service. See `docs/04-TECH-STACK.md`.
