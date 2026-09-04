# Maintainability NFR checks

These local checks implement M01, M02, the local portion of M03, M04, and M05 from
the SAS traceability matrix. At the user's request, M04 now measures code
complexity and replaces the former deployment-time requirement. All checks run
locally; nothing here deploys to AWS.

## Requirements and scope

| ID | Requirement / tactic | Acceptance criterion |
| --- | --- | --- |
| M01 | SRS section 6: at least 80% automated coverage; automated testing | Every component's tests pass and its line coverage is at least 80%. |
| M02 | Layer separation / MVC; service independence | Zero violations of the documented static dependency rules. The TypeScript checker must also accept valid fixtures and reject invalid fixtures. |
| M03 | Automated enforcement of the 80% threshold | Both Jest and pytest-cov reject a below-threshold fixture for a coverage failure while its assertions pass; both accept a fully covered fixture. |
| M04 | SRS section 6: understandable, modifiable functions; small focused functions | Cyclomatic complexity is at most 10 for every application function; zero analysis errors; boundary fixtures pass. |
| M05 | Code quality and reproducible builds | Existing ESLint rules report zero errors on application source and both declared production builds succeed. Warnings are recorded. |

The SRS does not define the coverage metric or component aggregation. **80% line
coverage per component is the proposed operational definition used for these
runs**, not a claim that the SRS already specifies it. Branch, function and
statement percentages from Jest are supplementary and do not replace that target.

M01 includes untested source:

- Frontend: `app/`, `components/`, `lib/`, and `middleware.ts`.
- Core: every TypeScript file in `backend/core/src/`.
- Ingestion and analytics: every Python file in each service's `src/` directory,
  including queue workers, the ingestion seeder and sensor emulator.
- Exclusions: TypeScript declarations, unit-test files, mocks, stories, config/build
  tooling and non-executable assets. Source-side `testMocks.tsx` is a test helper.
- Existing Jest/pytest test-discovery rules remain in use; files named `.totest`
  are not counted as executed tests.

M02 statically parses TypeScript/JavaScript imports, exports, literal `require()`
and literal dynamic imports, resolves relative imports and the frontend `@/`
alias, and follows dependencies through barrels. Rules are:

1. Core services cannot depend on controllers or routes.
2. Core validation cannot depend on controllers, routes or services.
3. Frontend source cannot depend on backend implementation files.
4. Core source cannot depend on frontend implementation files.
5. Static Python imports cannot couple ingestion to analytics or analytics to ingestion.

Unresolved internal code imports and non-literal JavaScript imports fail the
checker. Asset imports are outside its dependency scope. Python dynamic imports,
HTTP contracts, database coupling and general MVC correctness are not verified
by this check. Passing M02 establishes these explicit rules, not every possible
interpretation of four-tier isolation.

M04 scans the same application-source roots as M01, excluding test files, mocks,
stories, generated code, declarations and third-party code. It uses the installed
ESLint 8.57.1 `complexity` rule with the TypeScript parser and Radon 6.0.1 for
Python. The threshold is 10 per function, not an average or a limit on file size.
Both analyzers report every function, including nested functions and methods;
JavaScript callbacks and implicit class initializer functions are included.
Python lambdas are measured separately through an equivalent synthetic function
AST; Radon also counts their decisions within the enclosing block. No application
modules are imported or executed. Module-level Python statements are outside the
per-function metric. Analyzer versions matter because language constructs are
counted according to each tool's implementation.

ESLint performs a measurement pass at threshold 0 and an enforcement pass at 10.
Inline disabling comments cannot bypass this independent NFR check. The fixtures
verify scores of 10 and 11, nested functions and parse errors. Python fixtures
also cover async functions and methods/lambdas. A parser failure is a failed check.

Tool references: [ESLint complexity](https://eslint.org/docs/latest/rules/complexity)
and [Radon metrics](https://radon.readthedocs.io/en/latest/intro.html).

## Prepare and execute (PowerShell, from the repository root)

Use an installed Node/Corepack environment and the repository's pnpm dependencies.
The default local runner was exercised with Node 22.13.0 and pnpm 10.0.0.
Python environments are separate because the two services declare different
versions of shared packages. Python 3.12.13 was used in the recorded local run.

```powershell
corepack pnpm install --frozen-lockfile

python -m venv test-results/nfr-environments/ingestion
python -m venv test-results/nfr-environments/analytics

& ./test-results/nfr-environments/ingestion/Scripts/python.exe -m pip install -r backend/ingestion/requirements.txt pytest-cov==7.1.0 radon==6.0.1
& ./test-results/nfr-environments/analytics/Scripts/python.exe -m pip install -r backend/analytics/requirements.txt pytest-cov==7.1.0

node scripts/nfr-maintainability.mjs
```

Pass `--python-ingestion <executable>` and `--python-analytics <executable>` to use
existing environments. This computer's Python runtime was supplied by Codex;
another developer should use their own installed Python rather than copying its
machine-specific path. The harness records `pip freeze` output for each service.

Select checks when needed:

```powershell
node scripts/nfr-maintainability.mjs --only m02
node scripts/nfr-maintainability.mjs --only node-coverage,python-coverage
node scripts/nfr-maintainability.mjs --only m03
node scripts/nfr-maintainability.mjs --only m04
node scripts/nfr-maintainability.mjs --only m05
```

Runs create timestamped directories under `test-results/maintainability/`. Each
contains `results.json`, commands, timestamps, exit statuses and individual logs.
Coverage checks also produce HTML/JSON reports and test-result JSON/XML.
The runner exits nonzero if any selected check fails or cannot execute. Low
coverage fixture commands intentionally exit 1; their expected failure is a
passing M03 result when the assertions themselves passed.

The runner supplies dummy service settings and loopback endpoints. It unsets
`CORE_URL` for Jest because existing mocked route tests assert application
defaults, and unsets the optional `INFLUX_URL` alias so tests can set
`INFLUXDB_URL` directly; builds use a loopback override. It does not use deployment credentials.
Builds use the normal package scripts and generate local `.next`/`dist` outputs.

The NFR core Jest configuration adds its package's `node_modules` to module
resolution: tests live at repository root, outside the core package. No production
source code is changed to improve coverage or make tests pass.

## CI claim and evidence retention

These NFR configurations use a shared 80% threshold, but **the pre-existing CI
workflow does not invoke them**. Local M03 results do not establish that GitHub
blocks merging. CI invocation, an actual CI run and required-check settings must
be verified before reporting the full SAS merge-enforcement claim as satisfied.

`test-results/` is ignored by Git. Attach the relevant run directory to the demo
submission or upload it as a CI artifact; committing only this README will not
preserve the evidence. Keep failed results and measured coverage in the SAS;
do not lower targets or remove uncovered application code to turn a failure into
a pass.
