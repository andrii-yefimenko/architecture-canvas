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
- The application requires the cheepest SQL database.
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

#### Evaluation Rules
1. VPC must exist.
2. Public Subnet must be inside VPC.
3. Private Subnet must be inside VPC.
4. Internet Gateway must be inside VPC.
5. NAT Gateway must be inside Public Subnet.
6. EC2 (Frontend) must be present.
7. EC2 (Frontend) must be inside a Public Subnet.
8. RDS must be present.
9. Backend EC2 must be present.
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
- [ ] Application can be started locally.
- [ ] Application can be deployed locally according to README instructions.
- [ ] Challenge is displayed after opening the application.

### Requirements
- [ ] Challenge title and description are displayed.
- [ ] Visible requirements are displayed.
- [ ] Hidden requirements are initially hidden.
- [ ] Each hidden requirement can be revealed using a button.

### Services
- [ ] Available services are displayed in the Services panel.
- [ ] Services are grouped by category.
- [ ] Services can be dragged onto the Canvas.

### Canvas
- [ ] All services can be added, moved and removed from the Canvas.

### Submission
- [ ] User can submit the architecture.
- [ ] Score is calculated.
- [ ] Evaluation is displayed.
- [ ] User can see which requirements passed or failed.
