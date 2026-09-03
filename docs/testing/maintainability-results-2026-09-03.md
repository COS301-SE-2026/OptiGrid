# Maintainability NFR results — 3 September 2026

The local run passes M02 and M05 and the local enforcement checks in M03. M01
fails the 80% line-coverage threshold for frontend, core and ingestion. Analytics
meets the threshold. **All 1,080 application unit tests pass in the final runs.**
M04 now tests code complexity, replacing the deployment-time target at the user's request. It fails: 41 of 1,248 application functions exceed complexity 10.

## SAS traceability matrix

| Test ID | SRS quality requirement | Architectural tactic | Executable verification | Acceptance criterion | Actual result / status |
| --- | --- | --- | --- | --- | --- |
| M01 | Maintain at least 80% automated coverage | Automated tests and testable components | Jest and pytest-cov with all scoped source included, including untested files | All tests pass and each component reaches at least 80% line coverage | **FAIL overall.** Frontend 70.39%; core 74.12%; ingestion 44.49%; analytics 80.50%. |
| M02 | Maintainability through separation of concerns | Layered architecture, MVC and independent Python services | Parse and resolve source dependencies against documented rules; exercise allowed/forbidden TypeScript fixtures | No forbidden dependencies or analysis errors; checker fixtures behave as expected | **PASS within scope.** 171 TypeScript/JavaScript files, 218 internal edges, 14 Python files, zero violations; 6/6 TypeScript checker fixtures pass. |
| M03 | Enforce the 80% coverage rule | Automated quality checks in CI | Run below-threshold and passing fixtures through Jest and pytest-cov using the shared NFR threshold | Below-threshold runs fail specifically on coverage while assertions pass; full-coverage runs succeed. Full merge claim also requires CI wiring and a required GitHub check. | **PARTIAL.** Both tools reject 37.50% coverage (exit 1) and accept 100% (exit 0). Existing CI does not invoke these NFR configs; remote merge enforcement is unverified. |
| M04 | Cyclomatic complexity at most 10 per application function | Small, focused functions and separation of responsibilities | Analyze every scoped function with ESLint/Radon and verify boundary fixtures | Zero functions above 10, no analysis errors, and all analyzer fixtures pass | **FAIL overall.** 41/1,248 functions exceed 10: frontend 27, core 7, analytics 7, ingestion 0. All 11 analyzer fixtures pass. |
| M05 | Maintainability through code quality and reproducible builds | Static analysis and automated builds | Existing ESLint configuration on application source; normal frontend/core production build scripts | Zero lint errors and both builds succeed | **PASS with warnings.** Frontend: 0 errors, 16 warnings; core: 0 errors, 7 warnings. Frontend build 30.367s; core build 7.425s. |

## Coverage evidence

| Component | Unit tests | Covered / executable lines | Line coverage | Result |
| --- | --- | --- | --- | --- |
| Frontend | 640 passed / 640 | 2,299 / 3,266 | 70.39% | FAIL |
| Core | 366 passed / 366 | 1,702 / 2,296 | 74.12% | FAIL |
| Ingestion | 28 passed / 28 | 343 / 771 | 44.49% | FAIL |
| Analytics | 46 passed / 46 | 574 / 713 | 80.50% | PASS |

The threshold is not lowered when a component fails. The SRS states 80% automated
coverage without specifying a metric; line coverage per component is the proposed
operational definition used in these tests. Coverage includes all scoped source,
not just files imported by tests. Scope and exclusions are documented in the
[test instructions](../../tests/nfr/maintainability/README.md).

Ingestion includes `seeder.py` (210 executable lines) and `sensor_emulator.py`
(168 executable lines), both currently uncovered. Analytics includes the uncovered
31-line `queue_worker.py`. These findings identify where additional meaningful
tests are needed; no files were excluded simply to improve the result.

## M04 — Code complexity

The former deployment-time criterion was replaced on 3 September 2026 as requested.
The SRS and the editable SAS source now specify a maximum cyclomatic complexity
of **10 for every first-party application function**. This is a requirement
replacement, not evidence that the former deployment-time criterion passed.

| Component | Files | Functions | Functions above 10 | Highest complexity | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Frontend | 104 | 840 | 27 | 23 | FAIL |
| Core | 67 | 332 | 7 | 24 | FAIL |
| Ingestion | 8 | 42 | 0 | 9 | PASS |
| Analytics | 6 | 34 | 7 | 22 | FAIL |

The analyzers scanned 185 files and 1,248 functions without parse errors. All 11
fixtures pass, including complexity 10/11 boundaries and nested functions.

Highest scores:

| Function/location | Complexity |
| --- | ---: |
| `backend/core/src/services/building.services.ts:480` — Async arrow function | 24 |
| `frontend/app/(dashboard)/buildings/[buildingId]/edit/page.tsx:83` — Async arrow function | 23 |
| `frontend/app/(dashboard)/buildings/[buildingId]/sensors/sensors-client.tsx:51` — Function 'SensorsClient' | 23 |
| `backend/analytics/src/core_engine.py:429` — AnalyticsEngine.process_single_building | 22 |
| `frontend/app/(dashboard)/buildings/add/page.tsx:67` — Arrow function | 22 |
| `backend/core/src/controllers/analytics.controller.ts:81` — Async arrow function | 20 |
| `backend/analytics/src/core_engine.py:643` — AnalyticsEngine.process_all_buildings | 18 |
| `frontend/app/(auth)/signup/page.tsx:11` — Function 'SignupPage' | 18 |

The report lists all measured functions, not only violations. Anonymous JavaScript
functions are identified by file and line. The threshold is applied individually;
a low average cannot offset a function above 10. No application source was
refactored and no threshold was raised to obtain a passing result.

Run just this check:

```powershell
node scripts/nfr-maintainability.mjs --only m04
```

Counting conventions and exclusions are in the
[test instructions](../../tests/nfr/maintainability/README.md). JavaScript/TypeScript
uses ESLint 8.57.1 with the TypeScript parser; Python uses Radon 6.0.1, with
lambdas measured separately through equivalent synthetic function ASTs.
See the [ESLint rule](https://eslint.org/docs/latest/rules/complexity) and
[Radon metrics](https://radon.readthedocs.io/en/latest/intro.html) for definitions.

The updated [SAS LaTeX source](../SAS.tex) was reconstructed from the supplied
source text. The existing `docs/SAS.pdf` has not been regenerated: no LaTeX
compiler is available locally. Rebuild/export that source before submitting the
PDF; its old deployment-time wording is superseded by the revised source.

## What was verified and what remains

- M02 verifies the specific documented import rules, including TypeScript alias
  and barrel resolution. It does not prove every aspect of MVC, all database/API
  coupling, or Python dynamic-import behaviour.
- M03 proves local threshold enforcement only. The shared policy and NFR configs
  are separate from the existing CI workflow. The SAS statement that low coverage
  already blocks merging is not supported by the current repository configuration.
- M05 uses the project's existing rules. Warnings are permitted by the stated
  criterion. The root ESLint flat configuration currently enables a limited rule
  set, so passing lint is not a comprehensive assessment of code quality.
- Production builds ran locally with placeholder service configuration. No AWS
  resources were deployed. M05 measures build success independently of M04 complexity.
- Initial harness runs exposed pnpm resolution and environment-override issues.
  The NFR harness was corrected and affected checks rerun. Application source and
  the existing application unit tests were not changed to obtain these results.

## Reproduce and retain evidence

From the repository root, with dependencies prepared as described in the
[instructions](../../tests/nfr/maintainability/README.md):

```powershell
node scripts/nfr-maintainability.mjs
```

The runner intentionally returns a nonzero exit code when coverage is below 80%.
The fixture commands' expected nonzero exit codes are classified separately.

- [Packaged JSON results](../../test-results/maintainability/2026-09-03-final-v2/results.json)
- [Frontend coverage HTML](../../test-results/maintainability/2026-09-03-final-v2/frontend-and-boundaries/coverage-frontend/lcov-report/index.html)
- [Core coverage HTML](../../test-results/maintainability/2026-09-03-final-v2/core/coverage-core/lcov-report/index.html)
- [Ingestion coverage HTML](../../test-results/maintainability/2026-09-03-final-v2/python/coverage-ingestion/html/index.html)
- [Analytics coverage HTML](../../test-results/maintainability/2026-09-03-final-v2/python/coverage-analytics/html/index.html)
- [Dependency-check evidence](../../test-results/maintainability/2026-09-03-final-v2/frontend-and-boundaries/m02-typescript.json)
- [JavaScript/TypeScript complexity](../../test-results/maintainability/2026-09-03-final-v2/complexity/m04-javascript.json)
- [Python complexity](../../test-results/maintainability/2026-09-03-final-v2/complexity/m04-python.json)
- [Evidence ZIP](../../test-results/maintainability/maintainability-evidence-2026-09-03-v2.zip)

The archive contains final reports, logs, the NFR scripts/configuration, exact
Python package lists, command metadata and a SHA-256 manifest. It excludes the
Python environments and application credentials. `test-results/` is ignored by
Git, so attach the archive to the demo submission or store it as a CI artifact.

Environment: Windows, Node 22.13.0, pnpm 10.0.0, Python 3.12.13, pytest 9.1.1,
pytest-cov 7.1.0. Source commit: `47708a8f206369b3a33f92d02afe45a053450c0d`.
The checkout already contained edits to `infrastructure/docker-compose.local.frontend.yml`
and `scripts/docker-stack-up.mjs`; those files were left intact. New NFR scripts
and documentation are uncommitted.
