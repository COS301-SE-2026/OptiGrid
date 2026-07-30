# Software Architecture Specifications (SAS)
**Project Name:** OptiGrid
**Team Name:** Coreflow

---

## Table of Contents
* [1. Introduction](#1-introduction)
* [2. Architectural Requirements](#2-architectural-requirements)
  * [2.1 Architectural Patterns](#21-architectural-patterns)
  * [2.2 Design Patterns](#22-design-patterns)
  * [2.3 Constraints](#23-constraints)
  * [2.4 Architectural Diagram](#24-architectural-diagram)
  * [2.5 Mapping Quality Requirements to Architectural Decisions](#25-mapping-quality-requirements-to-architectural-decisions)
* [3. Technology Requirements](#3-technology-requirements)
* [4. API Contracts](#4-api-contracts)
* [5. Deployment](#5-deployment)
  * [5.1 Deployment Requirements](#51-deployment-requirements)
  * [5.2 Deployment Diagram](#52-deployment-diagram)
  * [5.3 CI/CD Pipeline Diagram](#53-cicd-pipeline-diagram)

---

## 1. Introduction

The Software Architecture Specifications (SAS) document serves as the main architectural guide for OptiGrid. While the Software Requirements Specification (SRS) focuses on *what* the system needs to do, the SAS explains *how* the system is structured to meet those requirements. This document outlines the architectural patterns, design choices, system constraints, and the technology stack utilized to keep the platform scalable and secure.

---

## 2. Architectural Requirements

### 2.1 Architectural Patterns

OptiGrid uses a hybrid approach, combining **Microservices** and **Event-Driven** patterns to ensure the system stays available and scales well.

* **Microservices Architecture:** 
  * *Definition:* The system is broken down into smaller, independent services based on what they do (like Data Ingestion, Analytics, and the Dashboard UI).
  * *Justification:* This is necessary because ingesting IoT telemetry data handles significantly more traffic than basic dashboard API queries. Keeping these separate means the ingestion containers can be scaled up during heavy data spikes without paying for extra frontend resources or slowing down the dashboard. It also lets the Python analytics engine run separately from the Node.js backend.
* **Event-Driven Architecture:**
  * *Definition:* Different parts of the system communicate asynchronously by sending events to a message broker.
  * *Justification:* If thousands of IoT meters try to send data at the exact same time, normal API calls would back up and probably crash the database. Using a Redis queue acts as a buffer. The ingestion service drops incoming data onto the queue, which lets the database write it at a safe, steady pace. This helps prevent data loss even if traffic spikes unexpectedly.
* **Layered Architecture:**
  * *Definition:* The system logic is split into separate presentation, analytics, and data access layers.
  * *Justification:* This keeps the codebase organized. For example, changing the user interface will not interfere with how data is ingested, which makes maintaining the system much easier.
* **Client-Server Architecture:**
  * *Definition:* A setup that splits work between resource providers (servers) and service requesters (clients).
  * *Justification:* OptiGrid keeps a strict boundary between the frontend dashboard (running in the browser) and the central API layer. This keeps the frontend fast and ensures all heavy processing is done on the servers.

### 2.2 Design Patterns

Several standard design patterns are used in the codebase to keep the system maintainable and reliable.

* **Model-View-Controller (MVC):**
  * *Definition:* Separates the application logic into three interconnected parts to separate internal information from how it is presented to the user.
  * *Justification:* This is used in the backend services and loosely mirrored in the React frontend. It separates the data models from the dashboard views using controllers, which makes the code easier to test and keeps different concerns separate.
* **Singleton Pattern:**
  * *Definition:* Restricts a class so it can only be created once.
  * *Justification:* This is used for the database connection pools (PostgreSQL and InfluxDB). Creating a brand new connection for every single request in a busy IoT system would cause massive delays and exhaust the available connections. A Singleton makes sure a single, persistent connection pool is reused.
* **Strategy Pattern:**
  * *Definition:* A pattern that lets you select a specific algorithm at runtime.
  * *Justification:* This is used in the Python Analytics engine to pick the right model. The system relies on Optuna to automatically test and choose the best forecasting strategy based on a building's specific energy profile, rather than hardcoding a single algorithm.

### 2.3 Constraints

The architectural choices are shaped by a few strict limitations:

* **Financial & Infrastructure Constraints:** The project operates under a strict R5000 budget provided by EPI-USE. *Impact:* The project cannot use paid enterprise software or expensive proprietary platforms. The system must stick to open-source tools and use cost-effective cloud options (like AWS Free Tier) to remain financially viable.
* **Hardware & Data Constraints:** Due to a lack of physical access to real world building smart grids, the system is constrained to supporting simulated telemetry data. *Impact:* The ingestion API has to be flexible enough to take standard JSON payloads over regular HTTPS. It will not be tied to specific hardware protocols, this will make it easier to add the real world sensor hardware later on.
* **Deployment Constraints:** The system has to be fully containerised and deployed through an automated CI/CD pipeline. *Impact:* Docker must be used for all services. All configuration settings are handled dynamically through `.env` variables so that the development, staging, and production environments are exactly the same without needing to alter code.
* **Latency & Performance Constraints:** Real-time dashboards must reflect data updates in under 2 seconds. *Impact:* A regular relational database cannot handle the heavy write speeds and fast read queries needed for IoT data. The system is forced to use a dedicated Time-Series Database (InfluxDB) that is built for this kind of workload.
* **Security & Regulatory Constraints:** The system handles potentially sensitive building operational data and must adhere strictly to the Protection of Personal Information Act (POPIA). *Impact:* Data has to be encrypted when stored, and strict Role-Based Access Control (RBAC) is needed so users only see their own buildings. The system also has to keep audit logs.

### 2.4 Architectural Diagram


### 2.5 Mapping Quality Requirements to Architectural Decisions

This table maps the quantified Non-Functional Requirements (from the SRS) directly to the architectural mechanisms that guarantee their fulfilment.

| Quality Requirement (from SRS) | Architectural Mechanism & Justification |
| :--- | :--- |
| **Performance:** Respond to requests within 2 seconds for 95% of requests. | **Time-Series Database & Pre-aggregation:** Using InfluxDB for telemetry makes querying date ranges very fast. Background cron jobs are also used to pre-calculate data into 15-minute and hourly summaries. This means the dashboard only has to load small datasets instead of calculating millions of rows on the fly. |
| **Scalability:** Support up to 200% workload increase with < 10% performance drop. | **Microservices + Docker Auto-scaling:** Because the Ingestion Service runs in its own lightweight Docker container, the cloud host can easily spin up extra copies of it when traffic spikes, spreading the load out horizontally. |
| **Security:** AES-256 encryption and multi-factor authentication enforcement. | **Centralised Authentication + TLS 1.3 + JWT:** The authentication layer serves as a strict gateway. All outside traffic is forced to use HTTPS (TLS 1.3), and short-lived JSON Web Tokens (JWTs) are used to safely verify user permissions on every request without storing session data. |
| **Reliability:** 99.9% uptime and recover from critical failures < 5 minutes. | **Message Broker (Redis Queue) Buffering:** If the main database goes down, the ingestion API will not lose data. Incoming telemetry waits safely in the Redis queue until the database comes back online, preventing data loss while the system recovers. |
| **Usability:** Core tasks completed in <5 min with major user satisfaction. | **Dashboard-First MVC UI Design:** Using React along with a robust state management system allows the UI to update instantly without reloading the page. A standard set of design tokens is also used to keep navigation clear and contrast ratios accessible. |
| **Maintainability:** New features or bug fixes deployable within 2 hours, 80% test coverage. | **Automated Pipelines & Separation of Concerns:** Because the layers are strictly separated and MVC is used, the code is much easier to unit test. The CI/CD pipeline runs these tests automatically, ensuring code is not merged unless it meets the 80% coverage rule. |

---

## 3. Technology Requirements

The following technology stack was selected to balance handling lots of data, running machine learning predictions, and building the UI quickly.

| Component | Selected Technology | Justification |
| :--- | :--- | :--- |
| **Frontend Platform** | **React.js** | React is great for building interactive, data-heavy dashboards. Its virtual DOM is fast enough to update complex graphs in real time without lagging. It also has a huge community, making it easy to drop in charting libraries (like Recharts or Chart.js) for the energy graphs. |
| **Backend API** | **Node.js (Express)** | The main challenge for OptiGrid's backend is handling thousands of small API requests at the same time. Node.js uses an event loop that does not block other processes, making it much better at handling high volumes of concurrent connections than traditional multi-threaded languages. |
| **Relational Database** | **PostgreSQL** | This is only used for system metadata (like user profiles, building configs, and permissions). PostgreSQL is reliable, handles complex table joins well, and ensures data stays strictly isolated between different tenants. |
| **Time-Series Database**| **InfluxDB** | Trying to store millions of telemetry data points in a standard SQL database usually ruins indexing performance over time. InfluxDB is specifically designed for time-stamped data, allowing for fast writes and easy automatic data downsampling. |
| **Analytics Engine** | **Python (scikit-learn, Pandas, Optuna)** | Python is the standard choice for data science. Using libraries like scikit-learn, Pandas, and Optuna allows the system to efficiently predict future demand based on historical data. Putting this in its own Python microservice allows the use of the best machine learning tools without bloating the Node.js backend. |
| **Containerisation** | **Docker** | Docker solves the "it works on my machine" problem. It ensures that the code runs exactly the same way on a developer's laptop, in the staging environment, and on the live cloud servers. |

---

## 4. API Contracts

## 5. Deployment

### 5.1 Deployment Requirements

### 5.2 Deployment Diagram

### 5.3 CI/CD Pipeline Diagram
