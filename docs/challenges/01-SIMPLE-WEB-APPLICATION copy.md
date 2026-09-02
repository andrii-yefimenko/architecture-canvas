# Challenge 01 — Simple Web Application

## Metadata

- **Challenge ID**: `challenge-01`
- **Title**: Simple web application (Simplified version)
- **Difficulty**: Beginner
- **Tags**: AWS, Single VPC, Three-Tier
- **Short description**: Design a basic three-tier web app — frontend, backend, and database — reachable from the Internet, without exposing the pieces that shouldn't be.

## Description

You're a group of friends who want to create a simple website where you can track your expenses for joint purchases and split them evenly.

## Visible Requirements

The application consists of three components:

- Frontend
- Backend
- SQL Database

The application should be accessible to users through the Internet.

## Hidden Requirements

### Infrastructure

- The entire application must be deployed inside a single VPC.
- The solution will use a single Availability Zone.

### Presentation Tier (Web / Frontend)

- The frontend must be accessible from the Internet.
- Code will be hosted on server.
- The frontend can be placed in a public subnet.

### Application Tier (Backend Logic)

- The backend needs to fetch external dependencies/updates from the Internet, but must not accept incoming requests from the Internet.
- Code will be hosted on server.
- The backend should be placed in a private subnet.

### Data Tier (Database)

- The database must not be directly accessible from the Internet.
- The application requires the cheapest SQL database.
- The database should be placed in a private subnet.

## Available Services

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

## Required Architecture

```text
VPC
 ├── Internet Gateway
 ├── Public Subnet
 │     ├── NAT Gateway
 │     └── EC2 (Frontend)
 │
 └── Private Subnet
       ├── EC2 (Backend)
       └── RDS
```

## Evaluation Rules

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

### Failure Example

- Requirement: Backend must be located in a private subnet.
- Result: Failed.
- Recommendation: Place the EC2 backend in a private subnet to prevent unauthorized access.
