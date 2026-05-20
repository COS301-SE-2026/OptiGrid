# OptiGrid User Stories

## A. Use-Case Derived User Stories

| ID | User Story | Acceptance Criteria | Traceability |
| --- | --- | --- | --- |
| US-001 | As a System Administrator, I want to configure API credentials for a building feed so that IoT telemetry can stream into OptiGrid. | Connection test returns success/failure reason; successful connection starts live ingestion status; credentials are stored securely. | UC1, R1.1, R1.3 |
| US-002 | As a Data Engineer, I want to upload historical CSV/JSON files so that backfill data is available for analytics. | File validation runs; parse/store summary is shown (inserted/rejected); completion notification is sent. | UC2, R1.1.2 |
| US-003 | As a Facility Manager, I want to view a real-time energy dashboard so that I can monitor current load and peaks. | Charts render (line/bar/heatmap); data refresh is near-real-time; tooltip, zoom, and pan work. | UC3, R3.1 |
| US-004 | As a Regional Director, I want to compare multiple buildings so that I can identify inefficient sites. | Up to 5 buildings selectable; side-by-side/overlay comparison renders; normalization by floor area available. | UC4, R3.2 |
| US-005 | As a Sustainability Officer, I want to export filtered reports to PDF/CSV so that I can share energy insights. | Date/metric filters applied to export; PDF snapshot and CSV raw data downloadable; export matches visible dashboard state. | UC5, R3.3 |
| US-006 | As a Maintenance Technician, I want to manage anomaly tickets from alert links so that incidents are tracked and closed. | Alert link opens exact incident; status can move Open/Investigating/Closed; action history is logged. | UC6, R4.2 |
| US-007 | As a Facility Manager, I want maintenance windows to suppress alerts so scheduled work does not create noise. | Suppression can be configured by building/time window; alerts muted only within window; suppression is audit logged. | UC7, R4.2.2 |
| US-008 | As a Facility Manager, I want to configure anomaly thresholds so detection matches building behavior. | Thresholds saved per building or meter; thresholds apply to future evaluations; invalid values are rejected. | UC8, R4.3.1 |
| US-009 | As a Building Operator, I want to view 72-hour/7-day demand forecasts so that I can plan operations. | Forecast graph shows predicted load; weather/occupancy inputs included when available; model version displayed. | UC9, R5.1, R5.2 |
| US-010 | As a Financial Officer, I want optimization recommendations with savings estimates so that I can reduce costs. | Recommendation list shows action plus expected savings; generation uses forecast and tariff; monthly savings estimate displayed. | UC10, R6 |
| US-011 | As a Financial Admin, I want to update Time-of-Use tariffs so that cost insights remain accurate. | Tariff schedules can be created/edited with effective dates; insights recalculate from new tariff; changes are audit logged. | UC11, R6.1 |
| US-012 | As a Data Scientist, I want to upload and activate a new forecast model so that forecast accuracy can improve without downtime. | Uploaded model is validated; activation hot-swap has no downtime; model version is stored. | UC12, R5.3 |
| US-013 | As a System Administrator, I want to create buildings so tenant portfolios can be managed. | Building CRUD captures address/floor area/timezone; created building appears in tenant portfolio. | UC13, R7.3 |
| US-014 | As a Global Administrator, I want to assign role-based building access so users only see permitted data. | Role plus building scope assignable; access enforced in UI and API; unauthorized access is blocked. | UC14, R7.1, R7.2 |
| US-015 | As a Tenant Viewer, I want password recovery so I can regain account access securely. | Forgot-password flow sends expiring secure link; password policy enforced on reset; reset event logged. | UC15, R7.2.1 |
| US-016 | As a System Administrator, I want to register/deactivate sensors so telemetry maps to correct building zones. | Meter create/update/deactivate supported; meter metadata stored; telemetry linked to chosen building and zone. | UC16, R8 |
| US-017 | As a System Administrator, I want to view audit logs so I can review security and config activity. | Filters by date/user/action available; immutable chronological logs shown; login/permission/config changes included. | UC17, R9 |
| US-018 | As a System Administrator, I want to monitor platform health so reliability issues are detected early. | Dashboard shows ingest rate, failures, delays, service errors, and DB uptime; system-level alerts trigger on failures. | UC18, R10 |
| US-019 | As a Global Administrator, I want to create and remove users so account lifecycle is controlled. | Admin can create/update/deactivate/delete users; welcome email on create; deactivated users cannot log in. | UC19, R7.4 |

## B. Enabler User Stories

| ID | User Story | Acceptance Criteria | Traceability |
| --- | --- | --- | --- |
| US-020 | As a Data Engineer, I want incoming telemetry normalized to a unified schema so downstream analytics are consistent. | Payload mapped to canonical JSON schema; timestamps normalized to UTC; units converted to kWh pre-storage. | R1.1.3, R1.1.4 |
| US-021 | As an SRE, I want resilient ingestion queuing so data is not lost during DB outages. | Message broker buffers events while DB is unavailable; replay succeeds after recovery; outage test shows no data loss. | R1.2.2 |
| US-022 | As a System Administrator, I want malformed payloads routed to a dead-letter queue so bad data can be triaged. | Invalid payload rejected with reason code; DLQ stores payload and validation error; admin review list available. | R1.2.3, R1.4 |
| US-023 | As a Data Platform Owner, I want automated rollups and archival so query performance remains stable at scale. | 15-min/1-hour/24-hour rollups generated; raw data older than 36 months archived; 30-day query meets latency target. | R2.2, R2.3 |
| US-024 | As an API Consumer, I want secure external query APIs so integrations can access data safely. | Authentication required on all endpoints; tenant-scoped authorization enforced; rate limiting and logging enabled. | R11.1 |
| US-025 | As a Security Admin, I want strict row-level tenant isolation so cross-tenant data leakage is impossible. | Row-level security enforced on tenant tables; cross-tenant access attempts are blocked; policy tests pass in CI. | R7.1 |
| US-026 | As an Operations Admin, I want configurable missing/duplicate value handling so data quality remains controlled. | Duplicate points flagged/rejected per policy; missing values handled by ignore/interpolate/flag; policy configurable per feed. | R1.4.2, R1.4.3 |
| US-027 | As an SRE, I want automated backups and tested restore so recovery is possible after failure. | Daily backups run automatically; restore validated in non-prod; restore audit report produced. | R12.1 |

