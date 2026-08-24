<div align="center">

# Coreflow - OptiGrid - Intelligent Energy Optimization

---

Built by **[Coreflow](https://github.com/OptiGrid)**

---

[![Build](https://img.shields.io/github/actions/workflow/status/COS301-SE-2026/OptiGrid/ci.yml?label=BUILD&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/actions)
[![Coverage](https://img.shields.io/coveralls/github/COS301-SE-2026/OptiGrid?label=COVERAGE&style=flat-square)](https://coveralls.io/github/COS301-SE-2026/OptiGrid)
[![Requirements](https://img.shields.io/badge/Requirements-Passing-success?style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid)
[![Issues](https://img.shields.io/github/issues/COS301-SE-2026/OptiGrid?label=ISSUES&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/issues)
[![Monitoring](https://img.shields.io/badge/Monitoring-UptimeRobot-brightgreen?style=flat-square)](https://uptimerobot.com)
[![Last Commit](https://img.shields.io/github/last-commit/COS301-SE-2026/OptiGrid?label=LAST+COMMIT&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/COS301-SE-2026/OptiGrid?label=REPO+SIZE&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid)
[![License](https://img.shields.io/github/license/COS301-SE-2026/OptiGrid?label=LICENSE&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/blob/main/LICENSE)

---

*In partnership with **EPI-USE***

**[OptiGrid URL](https://www.optigrid.co.za)** *(Click to view)*

</div>

---

## Project Description

OptiGrid is a comprehensive software platform designed for intelligent energy optimisation and predictive analytics, utilising smart grid technology to help buildings reduce energy waste and optimise consumption.
The system connects building managers and energy grids through a sophisticated data pipeline that facilitates telemetry ingestion, communicates forecasts, manages configurations, and provides real-time monitoring – all without fundamentally changing the existing building's physical infrastructure.

---

## Functional Requirements (SRS)
[Functional Requirements (SRS)](docs/SRS.md)

## GitHub Project Board
[View GitHub Project Board →](https://github.com/orgs/COS301-SE-2026/projects)

## Demo 2
**SRS Document:**
[Functional Requirements (SRS)](docs/SRS.md)

**SAS Document:**
[Functional Requirements (SAS)](docs/SAS.pdf)

**Coding Standards Document:**
[Coding Standards](docs/Coding_Standards.pdf)

**User Manual:**
[User Manual](docs/User_Manual.pdf)

**Testing Policy Document:**
[Testing Policy](docs/Testing_Policy.pdf)

**Brand Style Guide:**
[Brand Style Guide](docs/Brand_Style_Guide.pdf)

**Backend API:**
[System Health Dashboard API](docs/System_Health_API.md)

## Demo 1

**SRS Document:**
[Functional Requirements (SRS)](docs/SRS.md)

**Design Specification:**
[Design Specification and Brand Style Guide](docs/Brand_Style_Guide.pdf)

---

## Team: Coreflow

![Team Logo](docs/images/Screenshot%202026-05-21%20224726.png)

| Name | Student Number | GitHub | LinkedIn | Profile |
|------|---------------|--------|----------|-----------|
| Hamdaan Mirza | u24631494 | [GitHub](https://github.com/Hamdaan-Mirza) | [LinkedIn](https://www.linkedin.com/in/hamdaan-mirza/) | Team Lead, Backend Developer. |
| Abdelrahman Ahmed | u24898008 | [GitHub](https://github.com/abdlrhmanhabish) | [LinkedIn](https://www.linkedin.com/in/abdelrahman-esam-9055413b4) | Frontend Developer. |
| Abhay Rooplall | u24568792 | [GitHub](https://github.com/AbhayR1) | [LinkedIn](https://www.linkedin.com/in/abhay-rooplall/) | Data & Analytics Engineer. |
| Talifhani Seaba | u23657350 | [GitHub](https://github.com/TalifhaniSeaba) | [LinkedIn](https://www.linkedin.com/in/talifhani-seaba-2172bb32b/) | Frontend Developer. |
| Atidaishe Mupanemunda | u22747886 | [GitHub](https://github.com/WillyDoo428) | [LinkedIn](https://www.linkedin.com/in/atidaishe-m-218ba3388/) | Cloud & Infrastructure Engineer. |

**Team Email:** cos301.coreflow@gmail.com

**Team Photo:**

![Team Photo](docs/images/image.png)

---

## Repository Structure

```
OptiGrid
├─ .dockerignore
├─ .eslintrc.cjs
├─ README.md
├─ backend
│  ├─ analytics
│  │  ├─ Dockerfile
│  │  ├─ requirements.txt
│  │  └─ src
│  ├─ configuration
│  ├─ core
│  │  ├─ .eslintignore
│  │  ├─ Dockerfile
│  │  ├─ jest.config.cjs
│  │  ├─ prisma/
│  │  ├─ prisma.config.ts
│  │  └─ src
│  │     ├─ app.ts
│  │     ├─ controllers/
│  │     ├─ lib/
│  │     ├─ routes/
│  │     ├─ server.ts
│  │     ├─ services/
│  │     ├─ types/
│  │     └─ validation/
│  └─ ingestion
│     ├─ Dockerfile
│     ├─ prisma/
│     ├─ requirements.txt
│     └─ src
├─ docker-compose.yml
├─ docs
│  ├─ SRS.md
│  |_ images/
├─ eslint.config.cjs
├─ frontend
│  ├─ .storybook
│  │  ├─ main.ts
│  │  └─ preview.ts
│  ├─ Dockerfile
│  ├─ app
│  │  ├─ (auth)
│  │  │  ├─ login/
│  │  │  └─ signup/
│  │  ├─ (dashboard)
│  │  │  ├─ buildings/
│  │  │  ├─ compare/
│  │  │  ├─ dashboard/
│  │  │  ├─ forecast/
│  │  ├─ api/
│  │  ├─ contact/
│  │  ├─ faqs/
│  │  ├─ health/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  └─ theme/
│  ├─ eslint.config.mjs
│  ├─ jest.config.cjs
│  ├─ jest.setup.ts
│  └─ tailwind.config.ts
├─ infrastructure
│  ├─ docker/
│  └─ terraform/
├─ playwright.config.ts
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ scripts/
├─ supabase/
└─ tests
   ├─ integration/
   └─ unit/
   |_e2e/
```

---

## Technology Stack

**Frontend:**
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs) ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=flat-square&logo=reactquery&logoColor=white) ![Recharts](https://img.shields.io/badge/Recharts-2-22B5BF?style=flat-square)
Next.js (React with TypeScript)
For responsive web dashboard development. Fast iteration, rendering, and UI development using Tailwind CSS and Tremor. Supports dynamic data visualization via Recharts.

**Backend:**
![Node.js](https://img.shields.io/badge/NodeJS-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white) ![BullMQ](https://img.shields.io/badge/BullMQ-latest-FF0000?style=flat-square) ![Redis](https://img.shields.io/badge/Redis-latest-DC382D?style=flat-square&logo=redis&logoColor=white)
Node.js (Express with TypeScript)
High-performance REST API handling user requests, background tasks via BullMQ, caching via Redis, and automated data syncing.

**Database:**
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-latest-3ECF8E?style=flat-square&logo=supabase&logoColor=white) ![InfluxDB](https://img.shields.io/badge/InfluxDB-latest-22ADF6?style=flat-square&logo=influxdb&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-latest-2D3748?style=flat-square&logo=prisma&logoColor=white)
PostgreSQL (Supabase) & InfluxDB
Relational metadata stored in PostgreSQL and time-series telemetry data stored in InfluxDB. Object-relational mapping handled by Prisma.

**Analytics:**
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) ![Prophet](https://img.shields.io/badge/Prophet-latest-0066CC?style=flat-square) ![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-latest-F7931E?style=flat-square&logo=scikitlearn&logoColor=white) ![MLFlow](https://img.shields.io/badge/MLFlow-latest-0194E2?style=flat-square&logo=mlflow&logoColor=white) ![Optuna](https://img.shields.io/badge/Optuna-latest-6C4EAD?style=flat-square)
Python (Scikit-Learn, Prophet)
Machine learning service for predicting energy demands. Optuna manages the lifecycle and hyperparameter tuning.

**Hosting / Infrastructure:**
![Docker](https://img.shields.io/badge/Docker-latest-2496ED?style=flat-square&logo=docker&logoColor=white) ![AWS](https://img.shields.io/badge/AWS-Cloud-FF9900?style=flat-square&logo=amazonwebservices&logoColor=white) ![Terraform](https://img.shields.io/badge/Terraform-latest-844FBA?style=flat-square&logo=terraform&logoColor=white)
AWS
Infrastructure deployed via Terraform and managed with Docker containers.

**DevOps & Security:**
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=flat-square&logo=githubactions&logoColor=white) ![pnpm](https://img.shields.io/badge/pnpm-latest-F69220?style=flat-square&logo=pnpm&logoColor=white) ![Supabase Auth](https://img.shields.io/badge/Supabase_Auth-latest-3ECF8E?style=flat-square&logo=supabase&logoColor=white) ![Snyk](https://img.shields.io/badge/Snyk-Vulnerability_Scanning-4C4A73?style=flat-square&logo=snyk&logoColor=white)
GitHub Actions
Automated pipelines for testing, linting, and deployment. Vulnerability scanning with Snyk.

**Testing:**
![Jest](https://img.shields.io/badge/Jest-latest-C21325?style=flat-square&logo=jest&logoColor=white) ![Pytest](https://img.shields.io/badge/Pytest-latest-0A9EDC?style=flat-square&logo=pytest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-latest-2EAD33?style=flat-square&logo=playwright&logoColor=white) ![Testcontainers](https://img.shields.io/badge/Testcontainers-latest-291A3F?style=flat-square)
Jest, Pytest, Playwright
Unit and integration testing. End-to-end testing with Playwright.

---

## Getting Started

### Prerequisites

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/NodeJS-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-latest-2496ED?style=flat-square&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-latest-DC382D?style=flat-square&logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-latest-2D3748?style=flat-square&logo=prisma&logoColor=white)

Ensure the following are installed on your machine before proceeding:

- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [pnpm](https://pnpm.io/installation) - `npm install -g pnpm`
- [Docker](https://www.docker.com/get-started/) & Docker Compose
- [Redis](https://redis.io/docs/getting-started/) (or run via Docker)

### Clone & Install Dependencies

```bash
git clone https://github.com/COS301-SE-2026/OptiGrid
cd OptiGrid

# Install all Node.js workspace dependencies (Frontend & Backend Core)
pnpm install

# Install Python Analytics dependencies
pip install -r backend/analytics/requirements.txt

# Install Python Ingestion dependencies
pip install -r backend/ingestion/requirements.txt
```

### Environment Setup

Create a `.env.local` file in the root directory. Key environment variables include:

**Database & Supabase:**
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for backend operations |
| `SUPABASE_KEY` | Alias for Supabase key |

**InfluxDB:**
| Variable | Description |
|----------|-------------|
| `INFLUXDB_URL` | InfluxDB connection URL |
| `INFLUXDB_TOKEN` | InfluxDB authentication token |
| `INFLUXDB_ORG` | InfluxDB organization name |
| `INFLUXDB_BUCKET` | InfluxDB bucket name for energy data |

**Redis:**
| Variable | Description |
|----------|-------------|
| `REDIS_HOST` | Redis server hostname |
| `REDIS_PORT` | Redis port number |
| `REDIS_DB` | Redis database index |

**Third-party & Security:**
| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for email notifications |
| `HARDWARE_API_KEY` | Authentication key for hardware sensors |

### Run Locally

```bash
# Run all services concurrently
pnpm dev

# Run backend separately
pnpm --filter @optigrid/core dev

# Run frontend separately
pnpm --filter @optigrid/frontend dev
```

### Run with Docker

```bash
docker-compose up --build
```

### Run Lint

```bash
# Frontend
pnpm --filter @optigrid/frontend run lint

# Backend
pnpm --filter @optigrid/core run lint
```

### Run Unit Tests

```bash
# Run all unit tests
pnpm test:all

# Frontend unit tests only
pnpm --filter @optigrid/frontend run test

# Backend unit tests only
pnpm --filter @optigrid/core run test
```

### Run Integration Tests

```bash
# Run all backend integration tests
pnpm --filter @optigrid/core run test:integration

# Run backend integration tests using local Supabase instance
pnpm --filter @optigrid/core run test:supabase
```

### Run E2E Tests (Playwright)

Use this flow to run end-to-end tests using Playwright.

```bash
# Run standard E2E test suite
pnpm run test:e2e
```

**Running E2E tests with local Supabase:**
Use this flow when you want Playwright to test against the local Supabase emulator instead of the temporary Postgres container used by the default E2E launcher.

```bash
# Start local Supabase. If this repo has not been initialized locally yet,
# run 'supabase init' once from the repo root first.
supabase start
supabase status

# Run a specific test (e.g. create-building)
corepack pnpm run test:e2e:supabase -- tests/e2e/buildings/create-building.e2e.spec.ts
```

The Supabase E2E launcher reads `supabase status -o env` and maps the local `DB_URL`, `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` into the app environment automatically. It also runs `prisma db push --accept-data-loss` before starting the core API. It does not run `supabase/seed.sql`; keep that seed aligned with the current Prisma schema before using `supabase db reset`.

---

## Branching Strategy

This project follows **GitFlow**: a structured branching model that separates ongoing development from stable releases, enabling parallel feature work without destabilising production code.

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code only. Merges happen here via tagged releases from `develop`. Direct commits are not permitted. |
| `develop` | The primary integration branch. All completed features and fixes are merged here before being released to `main`. |
| `backend/feature/<name>` | Short-lived branches for individual backend features or fixes. Branch off `develop`, merge back via pull request once reviewed. |
| `frontend/feature/<name>` | Short-lived branches for individual frontend features or UI changes. Branch off `develop`, merge back via pull request once reviewed. |
| `integration/feature/<name>` | Used for cross-cutting changes that span both frontend and backend (e.g. new API contracts, full-stack features). Branch off `develop`, merge back after integrated testing. |

> **Pull Request policy:** All merges into `develop` require at least two approved reviews. All merges into `main` require at least three approved reviews. All merges must pass all CI checks before merging.

---

## Contact

| Role | Name | Email |
|------|------|-------|
| ▸ Project Owner | Durandt Uys | durandt.uys@epiuse.com |
| ▸ Project Mentor | Bryan Janse van Vuuren | bryan.janse.van.vuuren@epiuse.com |
| ▸ Team | Coreflow | cos301.coreflow@gmail.com |

---

<div align="center">
  <sub>© 2026 Coreflow · In partnership with EPI-USE</sub>
</div>
