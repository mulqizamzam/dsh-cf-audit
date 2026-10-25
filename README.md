# DSH Security Audit

**Creator:** `mulqizamzam`  
**Runtime target:** DeepSeek Harness `0.2.1-rc.2`  
**Release:** `0.1.0`  
**Runtime dependencies:** none beyond the host's existing skill registry and Node.js supplied with the host

DSH Security Audit adds focused security-workflow skills to DeepSeek Harness. It helps reviewers map trust boundaries, plan systematic source review, challenge candidate findings, design safe local tests, and produce consistent evidence-backed reports. It is a defensive review assistant—not a scanner that silently probes deployed systems.

## What it includes

- **Security audit:** a scoped, multi-stage codebase review with explicit authorization, coverage tracking, independent challenge, and structured reporting.
- **Security triage:** focused analysis of a suspected issue, including source tracing, impact boundaries, and a clear confirmed / unresolved / disproved distinction.
- **Security test plan:** safe local reproduction and regression-test design, with isolation requirements and stop conditions.
- **Local validators:** dependency-free Node scripts for coverage ledgers and finding reports; a report renderer produces Markdown from validated JSON.
- **Native DSH provider:** three on-demand skills registered with the Harness skill registry via the bundle's Cordis plugin.

The plugin does not add an MCP service, phone home, collect credentials, query external systems, or run code from the reviewed target on its own. Target-controlled commands, builds, and tests must only run when the operator has an OS-enforced sandbox meeting the conditions in the relevant skill.

## Prerequisites

- DeepSeek Harness exactly `0.2.1-rc.2` for this release. The manifest intentionally constrains the supported DSH prerelease range.
- Node.js `^22.19.0 || >=24.0.0` (the DSH v0.2.1-rc.2 workspace compatibility range) and Git for a CLI-managed installation. If using a desktop-distributed Harness, use its supported plugin manager and verify its bundled runtime.
- A profile that provides the Harness `skills` service and the model-facing skill loader. The standard `web` profile is the documented starting point.

This package does not require `DEEPSEEK_API_KEY` or any plugin-specific environment variable. Provider credentials remain a DSH concern and should never be put in audit artifacts.

## Install

From the DSH terminal, install this repository into the Web profile:

```sh
dsh --version
dsh plugin --profile web add github:mulqizamzam/dsh-cf-audit
```

Restart the Web profile and refresh the client if the new skills do not appear. For a different profile, replace `web` with that profile name; only do so when it exposes the `skills` service and skill tool. Installing the package changes the selected profile's bundle composition.

For an offline/local checkout, install the absolute directory path instead:

```sh
git clone https://github.com/mulqizamzam/dsh-cf-audit.git
cd dsh-cf-audit
# From the checkout directory, use its absolute path with the plugin manager:
dsh plugin --profile web add /absolute/path/to/dsh-cf-audit
```

The local install command accepts a local package directory; confirm it against `dsh plugin --help` for the installed DSH build before running it.

## Use

After installation, ask for a focused or full defensive review. Examples:

```text
Use security-triage to trace whether this route can read another tenant's data.
Perform a security audit of this repository, scoped to src/api and src/auth.
Create a sandboxed reproduction and regression-test plan for finding AUD-002.
Review this suspected path traversal issue and try to disprove it using the source.
```

The `security-audit` skill is intentionally reserved for explicit whole-codebase audits, comprehensive reviews, penetration-test requests against an authorized local target, or requests for structured report artifacts. Security questions and one-finding investigations should use `security-triage` instead.

## Report workflow

Create an output directory outside the target repository (or within a path explicitly approved and verified to be ignored by version control). Start from the checked-in JSON templates in [`docs/templates/`](docs/templates/) and replace the placeholder repository, revision, paths, times, limitations, and review units before use. Never let a target-controlled process write to retained report files.

Validate a coverage ledger and a report before rendering Markdown:

```sh
node scripts/validate-coverage.mjs /path/to/coverage.json
node scripts/validate-report.mjs /path/to/report.json
node scripts/render-report.mjs /path/to/report.json --out-dir /path/to/output
```

`render-report.mjs` refuses to render invalid report JSON. It writes `REPORT.md`, `FINDINGS.md`, and `NEEDS-VALIDATION.md` to the selected output directory; it does not modify reviewed source. The output directory must already exist.

### Finding dispositions

- **`verified`** — source evidence, a reachable path, bounded observed result, concrete security consequence, and an independent challenge are documented. Severity is permitted only for this disposition.
- **`unresolved`** — a source-grounded hypothesis remains blocked by a named missing fact. It must not carry a severity.
- **`disproved`** — the proposed claim was contradicted by current source or a bounded test; record why it was rejected.

“Not found” is not “secure.” Coverage means only that a declared review unit was examined; it does not prove exhaustive coverage of all reachable code or deployment behavior.

## Validation and development

Use Node's built-in test runner; no package install is required for the tests:

```sh
node --test
node scripts/validate-package.mjs
```

The package has not yet been smoke-tested under DSH `0.2.1-rc.2`: the release-preparation environment did not expose a DSH executable or package-registry access. The local automated checks exercise the provider contract with a mock host and validate report/coverage behavior. Before production use, install into a disposable profile running exactly DSH `0.2.1-rc.2`, confirm the three skills appear and load, then remove the test installation.

See [`CHANGELOG.md`](CHANGELOG.md), [`SECURITY.md`](SECURITY.md), and the source files for exact boundaries. All displayed creator identity in this project is `mulqizamzam`.
