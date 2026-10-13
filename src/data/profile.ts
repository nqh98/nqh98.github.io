export const profile = {
  name: 'Nguyen Quang Huy',
  role: 'Senior backend engineer',
  location: 'Ho Chi Minh City, Vietnam',
  email: 'huynguyen080898@gmail.com',
  linkedin: 'https://www.linkedin.com/in/huynq-771988166',
}

export interface Job {
  company: string
  domain: string
  title?: string
  from: string
  to: string
  summary: string
  points: { topic: string; text: string }[]
  stack: string[]
}

// Newest first. Offsets are assigned oldest = 0, like an append-only log.
export const jobs: Job[] = [
  {
    company: 'Arobid',
    domain: 'B2B e-commerce',
    title: 'Senior Engineer',
    from: 'Jan 2026',
    to: 'now',
    summary:
      'Building a new AI-powered cross-border trade platform that pairs B2B e-commerce with online trade expos, connecting suppliers to international buyers.',
    points: [
      {
        topic: 'Identity and onboarding',
        text: 'Designed authentication and user management, including KYC for individuals and KYB for businesses.',
      },
      {
        topic: 'Multi-tenancy',
        text: 'Designed the multi-tenant architecture on a shared schema, isolating data by tenant ID.',
      },
      {
        topic: 'Request for quotation',
        text: 'Designed the RFQ flows between buyers and suppliers.',
      },
      {
        topic: 'AI integration',
        text: 'Wired the AI team’s services into onboarding, so a business can be onboarded with AI assistance or in bulk from an uploaded list of company websites.',
      },
    ],
    stack: ['NestJS', 'TypeScript', 'Multi-tenancy', 'KYC / KYB'],
  },
  {
    company: 'Inspire Lab Technology',
    domain: 'Fintech',
    from: 'Sep 2021',
    to: 'Oct 2025',
    summary:
      'Designed and built core services of a microservices fintech platform: IAM migration off legacy auth, Smart OTP, risk management, P2P transfers, payment gateway integrations, reconciliation and financial reporting.',
    points: [
      {
        topic: 'Data consistency',
        text: 'Implemented the Transactional Outbox pattern with idempotent consumers, so retries and at-least-once delivery never process a payment twice.',
      },
      {
        topic: 'Event-driven architecture',
        text: 'Moved blocking service-to-service calls to Kafka, with partition keys for ordering and consumer groups for scale, which decoupled services and absorbed traffic spikes.',
      },
      {
        topic: 'Concurrency control',
        text: 'Prevented race conditions and lost updates with atomic conditional updates and optimistic or pessimistic locking in PostgreSQL, under explicit Spring transaction boundaries.',
      },
      {
        topic: 'Caching and performance',
        text: 'Introduced Redis caching on critical endpoints, with distributed locks against cache breakdown on hot keys, and tuned slow PostgreSQL queries.',
      },
      {
        topic: 'Provider integrations',
        text: 'Put OneSignal, SendGrid, Twilio and captcha services behind one pluggable abstraction, so a provider can be swapped without touching business logic.',
      },
      {
        topic: 'Team',
        text: 'Mentored junior developers, led code reviews, and worked with DevOps on GitLab CI/CD with automated tests and SonarQube quality gates.',
      },
    ],
    stack: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Redis', 'Clean Architecture'],
  },
  {
    company: 'Thi Truong Si',
    domain: 'E-commerce',
    from: 'Dec 2019',
    to: 'Sep 2021',
    summary:
      'Developed a wholesale marketplace serving over 1,000,000 customers: seller and buyer modules, RFQ, order processing, and payments through MoMo and cash on delivery.',
    points: [
      {
        topic: 'APIs',
        text: 'Designed REST APIs in PHP (Laravel) and Golang with the frontend and mobile teams, and optimised server-side code for response time.',
      },
      {
        topic: 'Data',
        text: 'Designed and maintained schemas across MySQL, MongoDB and ArangoDB.',
      },
      {
        topic: 'Frontend',
        text: 'Built responsive web apps and admin dashboards in React with Redux.',
      },
    ],
    stack: ['PHP (Laravel)', 'Golang', 'MySQL', 'MongoDB', 'ArangoDB', 'React'],
  },
]

export const skills: { area: string; tools: string; proof: string }[] = [
  {
    area: 'Backend',
    tools: 'Java, Spring Boot, NestJS (TypeScript), Golang, PHP (Laravel)',
    proof: 'Six years across fintech and two marketplaces',
  },
  {
    area: 'Architecture',
    tools: 'Microservices, event-driven architecture, multi-tenancy, Clean Architecture, DDD',
    proof: 'Core fintech services at Inspire Lab; tenant model at Arobid',
  },
  {
    area: 'Distributed systems',
    tools: 'Transactional Outbox, idempotency, distributed locking, hash-based sharding of scheduled jobs, eventual consistency',
    proof: 'P2P transfers and reconciliation at Inspire Lab',
  },
  {
    area: 'Concurrency',
    tools: 'Optimistic and pessimistic locking, atomic conditional updates, transaction management',
    proof: 'Concurrent money movement on PostgreSQL',
  },
  {
    area: 'Messaging',
    tools: 'Kafka: partition keys by user and priority, consumer groups, key-hashed worker threads, at-least-once delivery',
    proof: 'Replaced synchronous calls between services',
  },
  {
    area: 'Data and caching',
    tools: 'PostgreSQL, MySQL, MongoDB, ArangoDB, Redis; table partitioning by date, sharding by user ID',
    proof: 'Query tuning, hot-key caching, schema design',
  },
  {
    area: 'Quality',
    tools: 'JUnit, Mockito, SonarQube, GitLab CI/CD',
    proof: 'Quality gates in the pipeline; code review standards',
  },
]
