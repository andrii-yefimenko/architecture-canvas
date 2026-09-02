# Challenge 02 — Containerized Microservice (ECS Fargate)

## Metadata

- **Challenge ID**: `challenge-02`
- **Title**: Containerized Microservice with ECS Fargate
- **Difficulty**: Intermediate
- **Tags**: AWS, Containers, ECS, Fargate, ALB, VPC, Docker
- **Short description**: Modernize a monolithic deployment by hosting containerized microservices on AWS ECS with AWS Fargate (serverless compute), fronted by an Application Load Balancer in a dedicated VPC.

## Description

Your engineering team is moving away from managing standalone virtual machines (EC2) with manual OS updates and configuration drift. You need to design an isolated, container-native infrastructure for a web microservice packaged as a Docker container.

The service must run without managing underlying EC2 hosts (serverless containers), securely isolated from direct public Internet exposure, while receiving inbound HTTP traffic through a managed load balancer.

## Visible Requirements

The platform consists of three core components:

- Managed Layer 7 Load Balancer distributing traffic from the Internet.
- Serverless container orchestration running Docker tasks (no manual EC2 cluster management).
- Managed relational database for persistent application data.

The container workloads must not have direct public IP addresses.

## Hidden Requirements

### Infrastructure

- The entire container infrastructure must run within a dedicated VPC.
- The solution requires an isolated Public Subnet for public ingress and Private Subnets for workload isolation.
- The Public Subnet must contain an Internet Gateway route for public reachability.
- Workloads in the Private Subnet need outbound egress (to pull container images from registries and download dependencies) via a NAT Gateway located in the Public Subnet.

### Presentation & Ingress

- External client requests must terminate at an Application Load Balancer (ALB) placed in the Public Subnet.
- The ALB forwards incoming requests directly to the container service in the private network.

### Compute (Containers)

- Container orchestration must use an ECS Cluster.
- Compute tasks must run on AWS Fargate (serverless container compute) to avoid provisioning EC2 instances.
- The ECS Cluster running Fargate tasks must be deployed strictly inside a Private Subnet.

### Data Tier

- The relational database (RDS) must be placed in a Private Subnet to prevent public exposure.

## Available Services

- Networking and content delivery
    - VPC
        - Public Subnet
        - Private Subnet
        - Internet Gateway
        - NAT Gateway
    - Application Load Balancer
    - Route 53
    - CloudFront
- Compute & Containers
    - ECS Cluster
    - Fargate Task
    - EC2 (Backend)
    - EC2 (Frontend)
    - Lambda
    - EKS
- Databases & Storage
    - RDS
    - DynamoDB
    - ElastiCache
    - S3
    - ECR

## Required Architecture

```text
VPC
 ├── Internet Gateway
 ├── Public Subnet
 │    ├── Application Load Balancer
 │    └── NAT Gateway
 └── Private Subnet
      ├── ECS Cluster
      │    └── Fargate Task
      └── RDS
```

## Evaluation Rules
1. VPC must exist.
2. Public Subnet must be inside VPC.
3. Private Subnet must be inside VPC.
4. Internet Gateway must be inside VPC.
5. Application Load Balancer must be inside Public Subnet.
6. NAT Gateway must be inside Public Subnet.
7. ECS Cluster must be inside Private Subnet.
8. Fargate Task must be inside ECS Cluster.
9. RDS must be inside Private Subnet.

### Failure Example

Requirement: ECS Cluster must be inside Private Subnet.

Result: Failed.

Recommendation: Deploy your containerized workloads within a private subnet and route traffic via the load balancer to protect tasks from direct public scanning.
