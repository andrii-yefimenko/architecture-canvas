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

### Challenge #1
- Title: Simple web application (Simplified version)
- Description: You're a group of friends who want to create a simple website where you can track your expenses for joint purchases and split them evenly.

#### Visible Requirements
The application consists of three components:

- Frontend
- Backend
- SQL Database

The application should be accessible to users through the Internet.

#### Hidden Requirements

##### Infrastructure
- The entire application must be deployed inside a single VPC.
- The solution will use a single Availability Zone.

##### Presentation Tier (Web / Frontend)
- The frontend must be accessible from the Internet.
- Code will be hosted on server.
- The frontend can be placed in a public subnet.

##### Application Tier (Backend Logic)
- The backend needs to fetch external dependencies/updates from the Internet, but must not accept incoming requests from the Internet.
- Code will be hosted on server.
- The backend should be placed in a private subnet.

##### Data Tier (Database)
- The database must not be directly accessible from the Internet.
- The application requires the cheapest SQL database.
- The database should be placed in a private subnet.

#### Available Services
- Networking and content delivery
    - VPC
        - Public Subnet
        - Private Subnet
        - Internet Gateway
        - NAT Gateway
    - CloudFront
    - Route 53
    - Direct Connect
- Compute
    - EC2
        - Frontend
        - Backend
    - Lambda
    - ECS 
    - EKS
    - Fargate
    - Elastic Beanstalk
- Databases
    - RDS
    - Aurora
    - DynamoDB
    - ElastiCache
- Storage
    - S3
    - S3 Glacier
    - EBS
    - EFS

#### Required Architecture
VPC
 ├── Internet Gateway
 ├── Public Subnet
 │     ├── NAT Gateway
 │     └── EC2 (Frontend)
 │
 └── Private Subnet
       ├── EC2 (Backend)
       └── RDS

#### Validation
- Validation function takes current Canvas JSON tree structure and compares it against hardcoded Challenge #1 rules array.
- Validation runs entirely client-side; there is no backend service.
- A rule requiring a service to be "inside" a container is satisfied only when that container is the service's *direct* parent.
- Rules are existential: a rule passes if at least one node satisfies it, and duplicate nodes neither help nor hurt.

#### Evaluation Rules
1. VPC must exist.
2. Public Subnet must be inside VPC.
3. Private Subnet must be inside VPC.
4. Internet Gateway must be inside VPC.
5. NAT Gateway must be inside Public Subnet.
6. EC2 (Frontend) must be present.
7. EC2 (Frontend) must be inside a Public Subnet.
8. RDS must be present.
9. EC2 (Backend) must be present.
10. EC2 (Backend) must be inside a Private Subnet.
11. RDS must be inside a Private Subnet.

##### Failure Example
- Requirement: Backend must be located in a private subnet.
- Result: Failed.
- Recommendation: Place the EC2 backend in a private subnet to prevent unauthorized access.

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
