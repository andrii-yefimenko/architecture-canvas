# Challenge 02 — High Availability Web Application

## Metadata

- **Challenge ID**: `challenge-02`
- **Title**: High Availability Web Application
- **Difficulty**: Intermediate
- **Tags**: AWS, Multi-AZ, High-Availability, Auto-Scaling, Load-Balancing
- **Short description**: Upgrade a traditional three-tier application into a fault-tolerant, scalable architecture across multiple Availability Zones with load balancing, auto-scaling, and database failover.

## Description

Your expense-tracking application went viral! Due to rapid traffic growth, the single server setup experienced outages during peak hours. You now need to redesign the infrastructure for production-grade High Availability (HA), ensuring the platform tolerates a full data center failure with zero downtime and automatically handles traffic spikes.

## Visible Requirements

The production application must be resilient and scalable:

- Public entry point distributing external traffic across healthy instances.
- Auto-scaling frontend and backend compute layers across multiple zones.
- Highly available relational database with automatic failover support.
- Zero single points of failure across the compute and data layers.

## Hidden Requirements

### Infrastructure

- The entire architecture must be isolated inside a single VPC spanning 2 Availability Zones (AZ-a and AZ-b).
- Each AZ must contain an isolated Public Subnet and Private Subnet.
- Both Public Subnets must have egress to the Internet via an Internet Gateway.
- Private subnets require outbound Internet access (for patches/APIs) via a NAT Gateway placed in a Public Subnet.

### Presentation Tier (Web / Frontend)

- Incoming public HTTP/HTTPS traffic must terminate at an Application Load Balancer (ALB) distributed across Public Subnets.
- Frontend instances must be managed by an Auto Scaling Group spanning both Public Subnets.
- Frontend instances must accept traffic forwarded only by the Load Balancer.

### Application Tier (Backend Logic)

- Backend compute must not be directly reachable from the Internet.
- Backend instances must run inside an Auto Scaling Group spanning Private Subnets across both AZs.
- Backend workloads must communicate securely with the data tier within the private network.

### Data Tier (Database)

- The database must be a managed SQL database deployed in a Multi-AZ configuration (Primary + Standby replica).
- The database must reside strictly within Private Subnets across the Availability Zones and remain inaccessible from the public web.

## Available Services

- Networking and content delivery
    - VPC
        - Public Subnet (AZ-a)
        - Public Subnet (AZ-b)
        - Private Subnet (AZ-a)
        - Private Subnet (AZ-b)
        - Internet Gateway
        - NAT Gateway
    - Application Load Balancer (ALB)
    - CloudFront
    - Route 53
    - Direct Connect
- Compute
    - Auto Scaling Group (Frontend)
    - Auto Scaling Group (Backend)
    - EC2 (Frontend)
    - EC2 (Backend)
    - Lambda
    - ECS
    - EKS
    - Fargate
- Databases
    - RDS Multi-AZ
    - RDS Single-AZ
    - Aurora
    - DynamoDB
    - ElastiCache
- Management & Storage
    - S3
    - EBS
    - EFS
    - CloudWatch

## Required Architecture

```text
VPC
 ├── Internet Gateway
 ├── Application Load Balancer
 ├── Public Subnet (AZ-a)
 │    ├── NAT Gateway
 │    └── Auto Scaling Group (Frontend)
 ├── Public Subnet (AZ-b)
 │    └── Auto Scaling Group (Frontend)
 ├── Private Subnet (AZ-a)
 │    ├── Auto Scaling Group (Backend)
 │    └── RDS Multi-AZ
 └── Private Subnet (AZ-b)
      ├── Auto Scaling Group (Backend)
      └── RDS Multi-AZ
```

## Evaluation Rules
1. VPC must exist.
2. Internet Gateway must be inside VPC.
3. Application Load Balancer must be inside VPC.
4. Public Subnet (AZ-a) must be inside VPC.
5. Public Subnet (AZ-b) must be inside VPC.
6. Private Subnet (AZ-a) must be inside VPC.
7. Private Subnet (AZ-b) must be inside VPC.
8. NAT Gateway must be inside Public Subnet (AZ-a) or Public Subnet (AZ-b).
9. Auto Scaling Group (Frontend) must be inside Public Subnet (AZ-a).
10. Auto Scaling Group (Frontend) must be inside Public Subnet (AZ-b).
11. Auto Scaling Group (Backend) must be inside Private Subnet (AZ-a).
12. Auto Scaling Group (Backend) must be inside Private Subnet (AZ-b).
13. RDS Multi-AZ must be inside Private Subnet (AZ-a).
14. RDS Multi-AZ must be inside Private Subnet (AZ-b).

### Failure Example

- Requirement: Auto Scaling Group (Backend) must be present in Private Subnet (AZ-b).
- Result: Failed.
- Recommendation: Deploy backend instances via an Auto Scaling Group across private subnets in both Availability Zones to eliminate single-point-of-failure risks.
