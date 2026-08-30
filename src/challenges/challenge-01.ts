/**
 * Challenge #1 — authored data, transcribed from MVP.md.
 *
 * Content is transcribed rather than paraphrased: MVP.md is the source of truth
 * for the description, requirements, Service catalog, and the 11 Rules in their
 * numbered order. Referential integrity is guarded by challenge-01.test.ts.
 *
 * Framework-free, like everything under src/challenges/ (ADR 0001).
 */

import type { Challenge } from '@/domain/types';

export const challenge01: Challenge = {
  id: 'challenge-01',
  title: 'Simple web application (Simplified version)',
  description:
    "You're a group of friends who want to create a simple website where you can " +
    'track your expenses for joint purchases and split them evenly.',

  visibleRequirements: [
    'The application consists of three components: Frontend, Backend, and a SQL Database.',
    'The application should be accessible to users through the Internet.',
  ],

  hiddenRequirementCategories: [
    {
      id: 'infrastructure',
      name: 'Infrastructure',
      requirements: [
        'The entire application must be deployed inside a single VPC.',
        'The solution will use a single Availability Zone.',
      ],
    },
    {
      id: 'presentation-tier',
      name: 'Presentation Tier (Web / Frontend)',
      requirements: [
        'The frontend must be accessible from the Internet.',
        'Code will be hosted on server.',
        'The frontend can be placed in a public subnet.',
      ],
    },
    {
      id: 'application-tier',
      name: 'Application Tier (Backend Logic)',
      requirements: [
        'The backend needs to fetch external dependencies/updates from the Internet, ' +
          'but must not accept incoming requests from the Internet.',
        'Code will be hosted on server.',
        'The backend should be placed in a private subnet.',
      ],
    },
    {
      id: 'data-tier',
      name: 'Data Tier (Database)',
      requirements: [
        'The database must not be directly accessible from the Internet.',
        'The application requires the cheapest SQL database.',
        'The database should be placed in a private subnet.',
      ],
    },
  ],

  // The catalog deliberately includes distractors. A catalog containing only
  // correct answers would not test judgement (contracts/challenge.md).
  services: [
    // Networking and content delivery
    { id: 'vpc', name: 'VPC', category: 'Networking and content delivery' },
    { id: 'public-subnet', name: 'Public Subnet', category: 'Networking and content delivery' },
    { id: 'private-subnet', name: 'Private Subnet', category: 'Networking and content delivery' },
    { id: 'internet-gateway', name: 'Internet Gateway', category: 'Networking and content delivery' },
    { id: 'nat-gateway', name: 'NAT Gateway', category: 'Networking and content delivery' },
    { id: 'cloudfront', name: 'CloudFront', category: 'Networking and content delivery' },
    { id: 'route-53', name: 'Route 53', category: 'Networking and content delivery' },
    { id: 'direct-connect', name: 'Direct Connect', category: 'Networking and content delivery' },

    // Compute — EC2 roles are distinct Services, never one configurable Service (FR-010).
    { id: 'ec2-frontend', name: 'EC2 (Frontend)', category: 'Compute' },
    { id: 'ec2-backend', name: 'EC2 (Backend)', category: 'Compute' },
    { id: 'lambda', name: 'Lambda', category: 'Compute' },
    { id: 'ecs', name: 'ECS', category: 'Compute' },
    { id: 'eks', name: 'EKS', category: 'Compute' },
    { id: 'fargate', name: 'Fargate', category: 'Compute' },
    { id: 'elastic-beanstalk', name: 'Elastic Beanstalk', category: 'Compute' },

    // Databases
    { id: 'rds', name: 'RDS', category: 'Databases' },
    { id: 'aurora', name: 'Aurora', category: 'Databases' },
    { id: 'dynamodb', name: 'DynamoDB', category: 'Databases' },
    { id: 'elasticache', name: 'ElastiCache', category: 'Databases' },

    // Storage
    { id: 's3', name: 'S3', category: 'Storage' },
    { id: 's3-glacier', name: 'S3 Glacier', category: 'Storage' },
    { id: 'ebs', name: 'EBS', category: 'Storage' },
    { id: 'efs', name: 'EFS', category: 'Storage' },
  ],

  // The 11 Rules in MVP.md's numbered order, so the rendered checklist matches
  // the document. Recommendations state the action first, then the reason.
  rules: [
    {
      id: 'vpc-exists',
      kind: 'presence',
      serviceId: 'vpc',
      description: 'VPC must exist.',
      recommendation:
        'Add a VPC to the Canvas. The entire application must be deployed inside a single VPC.',
    },
    {
      id: 'public-subnet-in-vpc',
      kind: 'containment',
      serviceId: 'public-subnet',
      parentServiceId: 'vpc',
      description: 'Public Subnet must be inside VPC.',
      recommendation:
        'Place the Public Subnet directly inside the VPC, so internet-facing resources sit within the network boundary.',
    },
    {
      id: 'private-subnet-in-vpc',
      kind: 'containment',
      serviceId: 'private-subnet',
      parentServiceId: 'vpc',
      description: 'Private Subnet must be inside VPC.',
      recommendation:
        'Place the Private Subnet directly inside the VPC, so internal resources sit within the network boundary.',
    },
    {
      id: 'internet-gateway-in-vpc',
      kind: 'containment',
      serviceId: 'internet-gateway',
      parentServiceId: 'vpc',
      description: 'Internet Gateway must be inside VPC.',
      recommendation:
        'Place the Internet Gateway directly inside the VPC to give the network a route to and from the Internet.',
    },
    {
      id: 'nat-gateway-in-public-subnet',
      kind: 'containment',
      serviceId: 'nat-gateway',
      parentServiceId: 'public-subnet',
      description: 'NAT Gateway must be inside Public Subnet.',
      recommendation:
        'Place the NAT Gateway in the Public Subnet so private resources can reach the Internet for updates without accepting inbound traffic.',
    },
    {
      id: 'ec2-frontend-present',
      kind: 'presence',
      serviceId: 'ec2-frontend',
      description: 'EC2 (Frontend) must be present.',
      recommendation:
        'Add an EC2 (Frontend) instance. The frontend code will be hosted on a server.',
    },
    {
      id: 'ec2-frontend-in-public-subnet',
      kind: 'containment',
      serviceId: 'ec2-frontend',
      parentServiceId: 'public-subnet',
      description: 'EC2 (Frontend) must be inside a Public Subnet.',
      recommendation:
        'Place the EC2 frontend in a Public Subnet so users can reach it from the Internet.',
    },
    {
      id: 'rds-present',
      kind: 'presence',
      serviceId: 'rds',
      description: 'RDS must be present.',
      recommendation:
        'Add an RDS instance. The application requires the cheapest SQL database, and RDS is the managed SQL option.',
    },
    {
      id: 'ec2-backend-present',
      kind: 'presence',
      serviceId: 'ec2-backend',
      description: 'EC2 (Backend) must be present.',
      recommendation:
        'Add an EC2 (Backend) instance. The backend code will be hosted on a server.',
    },
    {
      id: 'ec2-backend-in-private-subnet',
      kind: 'containment',
      serviceId: 'ec2-backend',
      parentServiceId: 'private-subnet',
      description: 'EC2 (Backend) must be inside a Private Subnet.',
      recommendation:
        'Place the EC2 backend in a private subnet to prevent unauthorized access. It must fetch updates outbound without accepting inbound requests from the Internet.',
    },
    {
      id: 'rds-in-private-subnet',
      kind: 'containment',
      serviceId: 'rds',
      parentServiceId: 'private-subnet',
      description: 'RDS must be inside a Private Subnet.',
      recommendation:
        'Place the RDS database in a Private Subnet so it is not directly accessible from the Internet.',
    },
  ],
};
