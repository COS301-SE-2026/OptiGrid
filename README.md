<div align="center">

# OPTI**GRID**

*Intelligent Energy Optimization*

---

Built by **[Coreflow](https://github.com/OptiGrid)**

---

[![Build](https://img.shields.io/github/actions/workflow/status/COS301-SE-2026/OptiGrid/ci.yml?label=BUILD&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/actions)
[![Coverage](https://img.shields.io/coveralls/github/COS301-SE-2026/OptiGrid?label=COVERAGE&style=flat-square)](https://coveralls.io/github/COS301-SE-2026/OptiGrid)
[![Issues](https://img.shields.io/github/issues/COS301-SE-2026/OptiGrid?label=ISSUES&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/issues)
[![Last Commit](https://img.shields.io/github/last-commit/COS301-SE-2026/OptiGrid?label=LAST+COMMIT&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/COS301-SE-2026/OptiGrid?label=REPO+SIZE&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid)
[![License](https://img.shields.io/github/license/COS301-SE-2026/OptiGrid?label=LICENSE&style=flat-square)](https://github.com/COS301-SE-2026/OptiGrid/blob/main/LICENSE)

---

*In partnership with **EPI-USE***

**[Live System URL](https://YOUR-DEPLOYMENT-URL-HERE.com)** *(Click to view)*

</div>

---

## Documentation

**Project Management:** ‣ [View GitHub Project Board →](https://github.com/orgs/COS301-SE-2026/projects)

<details open>
  <summary><b>Demo 2 (Latest)</b></summary>
  <br>
  
  | Document | Link |
  |----------|------|
  | ‣ System Requirements Specification (SRS) | [View SRS →](docs/SRS.md) |
  | ‣ Software Architecture Specification (SAS) | [View SAS →](docs/SAS.md) |
  | ‣ Coding Standards | [View Coding Standards →](docs/Coding_Standards.md) |
  | ‣ Testing Policy | [View Testing Policy →](docs/Testing_Policy.md) |
  | ‣ User Manual | [View User Manual →](docs/User_Manual.md) |
  | ‣ Brand Style Guide | [View Brand Style Guide →](docs/Brand_Guidelines.html) |
  | ‣ Wireframes / Figma Panels | [View Wireframes →](docs/wireframes.html) |
  
</details>
<details>
  <summary><b>Demo 1</b></summary>
  <br>
  
  | Document | Link |
  |----------|------|
  | ‣ System Requirements Specification (SRS) | [View SRS →](docs/SRS.md) |
  | ‣ Design Specification and Brand Style Guide | [View Design Spec →](docs/Design_Specifications.md) |
  
</details>

---

## Team — Coreflow

| Name | Student Number | GitHub | LinkedIn | Profile |
|------|---------------|--------|----------|-----------|
| Hamdaan Mirza | u24631494 | [GitHub](https://github.com/Hamdaan-Mirza) | [LinkedIn](https://www.linkedin.com/in/hamdaan-mirza/) | Team Lead, Backend Developer. 
| Abdelrahman Ahmed | u24898008 | [GitHub](https://github.com/abdlrhmanhabish) | [LinkedIn](https://www.linkedin.com/in/abdelrahman-esam-9055413b4) |
| Abhay Rooplall | u24568792 | [GitHub](https://github.com/AbhayR1) | [LinkedIn](https://www.linkedin.com/in/abhay-rooplall/) |
| Talifhani Seaba | u23657350 | [GitHub](https://github.com/TalifhaniSeaba) | [LinkedIn](https://www.linkedin.com/in/talifhani-seaba-2172bb32b/) |
| Atidaishe Mupanemunda | u22747886 | [GitHub](https://github.com/WillyDoo428) | [LinkedIn](https://www.linkedin.com/in/atidaishe-m-218ba3388/) |

✉ **Team Email:** cos301.coreflow@gmail.com

📷 **Team Photo:**

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

## ◈ Technology Stack

### Justification for tech stack included in SAS.md, can be accessed through the link
#### Frontend
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=flat-square&logo=reactquery&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-2-22B5BF?style=flat-square)

* **Framework:** React + Next.js
* **Styling:** Tailwind CSS + Tremor
* **Data Fetching:** TanStack Query + Recharts

#### Backend
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-latest-FF0000?style=flat-square)
![Redis](https://img.shields.io/badge/Redis-latest-DC382D?style=flat-square&logo=redis&logoColor=white)

* **Runtime:** Node.js
* **Task Queues/Caching:** BullMQ + Redis

#### Database
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-latest-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![InfluxDB](https://img.shields.io/badge/InfluxDB-latest-22ADF6?style=flat-square&logo=influxdb&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-latest-2D3748?style=flat-square&logo=prisma&logoColor=white)

* **Relational:** PostgreSQL (Supabase)
* **Time-Series:** InfluxDB
* **ORM:** Prisma ORM

#### Analytics
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![Prophet](https://img.shields.io/badge/Prophet-latest-0066CC?style=flat-square)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-latest-F7931E?style=flat-square&logo=scikitlearn&logoColor=white)
![MLFlow](https://img.shields.io/badge/MLFlow-latest-0194E2?style=flat-square&logo=mlflow&logoColor=white)
![Optuna](https://img.shields.io/badge/Optuna-latest-6C4EAD?style=flat-square)

* **Language:** Python
* **Modeling:** Prophet + Scikit-Learn
* **Lifecycle Management:** MLFlow + Optuna

#### Infrastructure
![Docker](https://img.shields.io/badge/Docker-latest-2496ED?style=flat-square&logo=docker&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Cloud-FF9900?style=flat-square&logo=amazonwebservices&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-latest-844FBA?style=flat-square&logo=terraform&logoColor=white)

* **Containerization:** Docker
* **Cloud Hosting:** AWS
* **IaC:** Terraform

#### DevOps
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-latest-F69220?style=flat-square&logo=pnpm&logoColor=white)

* **CI/CD:** GitHub Actions
* **Workflow:** Gitflow
* **Package Manager:** pnpm (monorepo)

#### Security & Authentication
![Supabase Auth](https://img.shields.io/badge/Supabase_Auth-latest-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Snyk](https://img.shields.io/badge/Snyk-Vulnerability_Scanning-4C4A73?style=flat-square&logo=snyk&logoColor=white)

* **Auth Provider:** Supabase Auth
* **Vulnerability Scanning:** Snyk

#### Testing
![Jest](https://img.shields.io/badge/Jest-latest-C21325?style=flat-square&logo=jest&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-latest-0A9EDC?style=flat-square&logo=pytest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-latest-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![Testcontainers](https://img.shields.io/badge/Testcontainers-latest-291A3F?style=flat-square)

* **Unit/Integration:** Jest + Pytest + Supertest
* **Testing Infrastructure:** Testcontainers
* **E2E Testing:** Playwright

---

## Getting Started

### Prerequisites

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-8+-F69220?style=flat-square&logo=pnpm&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-latest-2496ED?style=flat-square&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-latest-DC382D?style=flat-square&logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-latest-2D3748?style=flat-square&logo=prisma&logoColor=white)

Ensure the following are installed on your machine before proceeding:

- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [pnpm](https://pnpm.io/installation) — `npm install -g pnpm`
- [Docker](https://www.docker.com/get-started/) & Docker Compose
- [Redis](https://redis.io/docs/getting-started/) (or run via Docker)

### Clone & Install Dependencies

```bash
git clone https://github.com/COS301-SE-2026/OptiGrid
cd OptiGrid

# Root dependencies
pnpm install

# Python Analytics service
pip install -r backend/analytics/requirements.txt

# Python Ingestion service
pip install -r backend/ingestion/requirements.txt

# Frontend
cd frontend && pnpm install
```

### Environment Setup

Key environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous public key |
| `INFLUXDB_URL` | InfluxDB connection URL |
| `INFLUXDB_TOKEN` | InfluxDB auth token |
| `REDIS_URL` | Redis connection URL |

### Run Locally

```bash
# Run all services concurrently
pnpm dev

# Run backend separately
cd backend && pnpm dev

# Run frontend separately
cd frontend && pnpm dev
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

### Run Tests

```bash
# Run all tests
pnpm test:all

# Frontend unit tests only
pnpm --filter @optigrid/frontend run test

# Backend unit tests only
pnpm --filter @optigrid/core run test
```

### Run Building E2E Tests with Local Supabase

Use this flow when you want Playwright to test against the local Supabase emulator instead of the temporary Postgres container used by the default E2E launcher.

```powershell
# Start local Supabase. If this repo has not been initialized locally yet,
# run `supabase init` once from the repo root first.
supabase start
supabase status
```

Run the create-building E2E test:

```powershell
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

> **Pull Request policy:** All merges into `develop` and `main` require at least two approved review. CI checks (lint, unit tests, build, integration tests) must pass before merging.

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
