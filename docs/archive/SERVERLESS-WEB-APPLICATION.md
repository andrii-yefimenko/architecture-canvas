# Challenge 02 — Serverless Web Application

## Metadata

- **Challenge ID**: `challenge-02`
- **Title**: Serverless Web Application
- **Difficulty**: Beginner
- **Tags**: AWS, Serverless, CloudFront, S3, API Gateway, Lambda, DynamoDB
- **Short description**: Design a cost-effective, serverless web application with zero idle compute costs — combining a global CDN, static web hosting, serverless API routing, on-demand compute, and managed NoSQL storage.

## Description

You are building a lightweight bookmarking and note-sharing service for students. Traffic fluctuates wildly: thousands of users during exam periods and almost zero traffic at night and during holidays. 

To keep operational overhead and costs minimal, you must design a 100% Serverless architecture that automatically scales with demand, has zero server maintenance (no OS patching), and charges strictly per request with no idle running costs.

## Visible Requirements

The platform consists of four key components:

- Static Web Frontend (HTML/JS/CSS).
- Public REST API endpoint.
- Serverless Backend execution logic.
- Managed database for storing user notes.

The solution must be accessible to public internet users, highly scalable, and require zero virtual server management.

## Hidden Requirements

### Infrastructure & Edge

- All incoming traffic should pass through a global Content Delivery Network (CDN) to ensure low-latency static delivery and edge protection.
- The CDN must route frontend asset requests and dynamic `/api/*` calls under a single unified domain without provisioning a VPC.

### Presentation Tier (Frontend)

- Frontend assets must be hosted in cost-effective object storage without running a web server.
- The static storage must be securely integrated as an origin behind the CDN distribution.

### Application Tier (Backend Logic)

- The REST API must be managed by an API Gateway serving as an origin behind the CDN.
- Business logic must run purely on-demand using event-driven compute (no always-on compute instances).
- The compute logic must be directly attached to the API Gateway.

### Data Tier (Database)

- The application requires a fully managed serverless NoSQL database that scales to zero and scales up on demand.
- The database must not require provisioning clusters, subnets, or managing database connections.

## Available Services

- Networking & Content Delivery
    - CloudFront
    - API Gateway
    - Route 53
    - VPC
    - Public Subnet
    - Private Subnet
    - Internet Gateway
    - NAT Gateway
    - Application Load Balancer
- Storage
    - S3 (Frontend)
    - EBS
    - EFS
- Compute
    - Lambda
    - EC2 (Frontend)
    - EC2 (Backend)
    - ECS
    - Fargate
- Databases
    - DynamoDB
    - RDS
    - Aurora
    - ElastiCache

## Required Architecture

```text
CloudFront
 ├── S3 (Frontend)
 └── API Gateway
      └── Lambda

DynamoDB
```

## Evaluation Rules
1. CloudFront must exist.
2. S3 (Frontend) must be present.
3. S3 (Frontend) must be inside CloudFront.
4. API Gateway must be present.
5. API Gateway must be inside CloudFront.

Lambda must be present.

Lambda must be inside API Gateway.

DynamoDB must be present.

### Failure Example

Requirement: Lambda must be inside API Gateway.

Result: Failed.

Recommendation: Integrate your Lambda function directly with API Gateway so HTTP requests can trigger backend code execution.
