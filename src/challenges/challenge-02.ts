/**
 * Challenge #2 — authored data, transcribed from
 * docs/challenges/02-CONTAINERIZED-WEB-APPLICATION.md.
 *
 * Content is transcribed rather than paraphrased: that document is the source
 * of truth for the description, requirements, Service catalog, and the 9
 * Rules in their numbered order. Referential integrity is guarded by
 * challenge-02.test.ts.
 *
 * Several Service ids are intentionally shared with challenge-01.ts (`vpc`,
 * `public-subnet`, `private-subnet`, `internet-gateway`, `nat-gateway`, `rds`,
 * and others) — they are the same real AWS services. This is exactly the
 * shared-id scenario src/state/persistence.ts's per-Challenge scoping exists
 * to isolate; see specs/002-multi-challenge-catalog/research.md.
 *
 * Framework-free, like everything under src/challenges/ (ADR 0001).
 */

import type { Challenge } from '@/domain/types';

export const challenge02: Challenge = {
  id: 'challenge-02',
  title: 'Containerized Microservice with ECS Fargate',
  description:
    'Your engineering team is moving away from managing standalone virtual machines ' +
    '(EC2) with manual OS updates and configuration drift. You need to design an ' +
    'isolated, container-native infrastructure for a web microservice packaged as a ' +
    'Docker container. The service must run without managing underlying EC2 hosts ' +
    '(serverless containers), securely isolated from direct public Internet exposure, ' +
    'while receiving inbound HTTP traffic through a managed load balancer.',
  difficulty: 'intermediate',
  tags: ['AWS', 'Containers', 'ECS', 'Fargate', 'ALB', 'VPC', 'Docker'],
  shortDescription:
    'Modernize a monolithic deployment by hosting containerized microservices on AWS ' +
    'ECS with AWS Fargate (serverless compute), fronted by an Application Load ' +
    'Balancer in a dedicated VPC.',

  visibleRequirements: [
    'The platform consists of three core components: a managed Layer 7 Load Balancer ' +
      'distributing traffic from the Internet, serverless container orchestration ' +
      'running Docker tasks (no manual EC2 cluster management), and a managed ' +
      'relational database for persistent application data.',
    'The container workloads must not have direct public IP addresses.',
  ],

  hiddenRequirementCategories: [
    {
      id: 'infrastructure',
      name: 'Infrastructure',
      requirements: [
        'The entire container infrastructure must run within a dedicated VPC.',
        'The solution requires an isolated Public Subnet for public ingress and ' +
          'Private Subnets for workload isolation.',
        'The Public Subnet must contain an Internet Gateway route for public ' +
          'reachability.',
        'Workloads in the Private Subnet need outbound egress (to pull container ' +
          'images from registries and download dependencies) via a NAT Gateway ' +
          'located in the Public Subnet.',
      ],
    },
    {
      id: 'presentation-ingress',
      name: 'Presentation & Ingress',
      requirements: [
        'External client requests must terminate at an Application Load Balancer ' +
          '(ALB) placed in the Public Subnet.',
        'The ALB forwards incoming requests directly to the container service in ' +
          'the private network.',
      ],
    },
    {
      id: 'compute-containers',
      name: 'Compute (Containers)',
      requirements: [
        'Container orchestration must use an ECS Cluster.',
        'Compute tasks must run on AWS Fargate (serverless container compute) to ' +
          'avoid provisioning EC2 instances.',
        'The ECS Cluster running Fargate tasks must be deployed strictly inside a ' +
          'Private Subnet.',
      ],
    },
    {
      id: 'data-tier',
      name: 'Data Tier',
      requirements: [
        'The relational database (RDS) must be placed in a Private Subnet to ' +
          'prevent public exposure.',
      ],
    },
  ],

  // The catalog deliberately includes distractors, including EC2 (Frontend) and
  // EC2 (Backend) — the legacy pattern this Challenge is meant to move away
  // from. No Rule references either; that is intentional (see the Q2
  // resolution in docs/03-BACKLOG.md), not an oversight.
  services: [
    // Networking and content delivery
    { id: 'vpc', name: 'VPC', category: 'Networking and content delivery' },
    { id: 'public-subnet', name: 'Public Subnet', category: 'Networking and content delivery' },
    { id: 'private-subnet', name: 'Private Subnet', category: 'Networking and content delivery' },
    { id: 'internet-gateway', name: 'Internet Gateway', category: 'Networking and content delivery' },
    { id: 'nat-gateway', name: 'NAT Gateway', category: 'Networking and content delivery' },
    {
      id: 'application-load-balancer',
      name: 'Application Load Balancer',
      category: 'Networking and content delivery',
    },
    { id: 'route-53', name: 'Route 53', category: 'Networking and content delivery' },
    { id: 'cloudfront', name: 'CloudFront', category: 'Networking and content delivery' },

    // Compute & Containers
    { id: 'ecs-cluster', name: 'ECS Cluster', category: 'Compute & Containers' },
    { id: 'fargate-task', name: 'Fargate Task', category: 'Compute & Containers' },
    { id: 'ec2-backend', name: 'EC2 (Backend)', category: 'Compute & Containers' },
    { id: 'ec2-frontend', name: 'EC2 (Frontend)', category: 'Compute & Containers' },
    { id: 'lambda', name: 'Lambda', category: 'Compute & Containers' },
    { id: 'eks', name: 'EKS', category: 'Compute & Containers' },

    // Databases & Storage
    { id: 'rds', name: 'RDS', category: 'Databases & Storage' },
    { id: 'dynamodb', name: 'DynamoDB', category: 'Databases & Storage' },
    { id: 'elasticache', name: 'ElastiCache', category: 'Databases & Storage' },
    { id: 's3', name: 'S3', category: 'Databases & Storage' },
    { id: 'ecr', name: 'ECR', category: 'Databases & Storage' },
  ],

  // The 9 Rules in the source document's numbered order. presence/containment
  // only — no new Rule kind (specs/002-multi-challenge-catalog/research.md).
  rules: [
    {
      id: 'vpc-exists',
      kind: 'presence',
      serviceId: 'vpc',
      description: 'VPC must exist.',
      recommendation:
        'Add a VPC to the Canvas. The entire container infrastructure must run within a dedicated VPC.',
    },
    {
      id: 'public-subnet-in-vpc',
      kind: 'containment',
      serviceId: 'public-subnet',
      parentServiceId: 'vpc',
      description: 'Public Subnet must be inside VPC.',
      recommendation:
        'Place the Public Subnet directly inside the VPC, so public-ingress resources sit within the network boundary.',
    },
    {
      id: 'private-subnet-in-vpc',
      kind: 'containment',
      serviceId: 'private-subnet',
      parentServiceId: 'vpc',
      description: 'Private Subnet must be inside VPC.',
      recommendation:
        'Place the Private Subnet directly inside the VPC, so isolated workloads sit within the network boundary.',
    },
    {
      id: 'internet-gateway-in-vpc',
      kind: 'containment',
      serviceId: 'internet-gateway',
      parentServiceId: 'vpc',
      description: 'Internet Gateway must be inside VPC.',
      recommendation:
        'Place the Internet Gateway directly inside the VPC to give the Public Subnet a route to and from the Internet.',
    },
    {
      id: 'alb-in-public-subnet',
      kind: 'containment',
      serviceId: 'application-load-balancer',
      parentServiceId: 'public-subnet',
      description: 'Application Load Balancer must be inside Public Subnet.',
      recommendation:
        'Place the Application Load Balancer in the Public Subnet so it can terminate external client requests before forwarding them into the private network.',
    },
    {
      id: 'nat-gateway-in-public-subnet',
      kind: 'containment',
      serviceId: 'nat-gateway',
      parentServiceId: 'public-subnet',
      description: 'NAT Gateway must be inside Public Subnet.',
      recommendation:
        'Place the NAT Gateway in the Public Subnet so private workloads can pull container images and dependencies without accepting inbound traffic.',
    },
    {
      id: 'ecs-cluster-in-private-subnet',
      kind: 'containment',
      serviceId: 'ecs-cluster',
      parentServiceId: 'private-subnet',
      description: 'ECS Cluster must be inside Private Subnet.',
      recommendation:
        'Deploy your containerized workloads within a private subnet and route traffic via the load balancer to protect tasks from direct public scanning.',
    },
    {
      id: 'fargate-task-in-ecs-cluster',
      kind: 'containment',
      serviceId: 'fargate-task',
      parentServiceId: 'ecs-cluster',
      description: 'Fargate Task must be inside ECS Cluster.',
      recommendation:
        'Nest the Fargate Task inside the ECS Cluster so it runs as serverless compute under that cluster\'s orchestration, rather than a standalone instance.',
    },
    {
      id: 'rds-in-private-subnet',
      kind: 'containment',
      serviceId: 'rds',
      parentServiceId: 'private-subnet',
      description: 'RDS must be inside Private Subnet.',
      recommendation:
        'Place the RDS database in a Private Subnet so it is not directly accessible from the Internet.',
    },
  ],
};
