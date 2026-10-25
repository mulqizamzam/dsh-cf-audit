---
name: security-audit
description: Run a scoped, multi-stage defensive security review of a local codebase when the user explicitly requests a full audit, comprehensive review, authorized penetration test of local code, or structured report artifacts.
---

# Security Audit

Produce an evidence-led review of an authorized codebase. The objective is to identify concrete security-boundary failures, verify or reject each candidate, and communicate the smallest effective fix. This workflow does not authorize active testing of deployed services.

## Invocation boundary

Use this complete workflow only when the user explicitly requests a full / comprehensive codebase audit, an authorized penetration test of a local target, or audit report artifacts. For a single suspected issue or general security question, prefer `security-triage`. If “audit” could mean either a focused question or a full run, ask one concise scope question before creating files or running a broad investigation.

## Non-negotiable execution safety

Source inspection is read-only by default. Execute target-controlled builds, tests, binaries, browser flows, fuzzers, fixtures, or package scripts only inside an OS-enforced sandbox that has every control below:

- external networking disabled (loopback only if a local test needs a client/server pair);
- an empty environment populated from an explicit safe allowlist, with isolated home, temp, and cache paths;
- reviewed source/toolchain read-only to the target process, with writes limited to one assigned scratch directory;
- explicit CPU, memory, process, file-size, disk, and wall-clock limits;
- no access to credentials, host sockets, shared services, retained reports, other agents' files, or unrelated host paths.

Do not install dependencies, fetch packages, contact public targets, test production identities, or mutate deployment state. Use synthetic users and dummy secrets. If one required control is missing, do not execute target code; keep the claim unresolved and state the exact blocker. Do not make a target process the writer of retained evidence.

## Establish the run

1. Resolve the repository root, source revision, dirty/untracked state, relevant build/test entry points, and any prior compatible audit records. Never mix unreviewed working-tree changes with a clean commit claim.
2. Confirm the user's authorization and record exact in-scope paths, explicit exclusions, threat assumptions, and any time/resource budget. Do not expand into external targets or credentials.
3. Choose an output directory outside the target repository. Writing inside the target is permitted only when the user selects that path and it is verified to be ignored by version control. Create a fresh run directory; do not overwrite a previous run.
4. Record run identity, source revision, scope, allowed execution policy, and status. Mark the run `incomplete` if a required phase cannot be completed. A completed workflow may still contain unresolved issues.
5. Read every prior relevant coverage ledger and issue record when available. Re-check prior evidence against current source; never count a stale record as proof of current behavior.

## Phase A — Map the system and trust boundaries

Build a concise system map showing entry points, components, sensitive assets, principals, privilege transitions, storage, network boundaries, and security-relevant dependencies. Follow actual control/data flow through the implementation. Record the source files that establish each boundary and the assumptions that cannot be observed from source alone.

Inventory code and configuration by security surface: authentication/session management, authorization and tenancy, parsing/serialization, file and path access, process execution, network/protocol behavior, secrets and logging, client rendering, dependency/build/release paths, resource ownership/quotas, and data retention/export/deletion. Select only surfaces relevant to the target; add technology-specific ones when the architecture justifies them.

## Phase B — Plan and track coverage

Create a deterministic ledger of review units before deep hunting. Every unit needs a unique stable ID, relevant paths, surface, priority, planned checks, and a state. Prefer one actionable unit per trust boundary or closely related path.

Move units through `planned`, `active`, `candidate`, `reviewed`, `blocked`, or `excluded`. Record actual work and remaining questions. `reviewed` means the declared checks were performed—not that the unit is safe. `excluded` requires a reason. `blocked` requires the precise fact or capability preventing a conclusion. Update the ledger after each investigation wave. Use prior runs to find gaps, but revalidate prior claims whenever relevant source or assumptions have changed.

## Phase C — Investigate candidates

For each prioritized unit, trace attacker-controlled data and identity from entry to the last trusted decision point and onward to the sensitive operation. Form concrete hypotheses and look for code paths that disprove them, including guards, canonicalization, permission checks, transaction boundaries, and downstream enforcement. Use code search, local tests, static analysis, and existing tests when available; record which method actually ran.

A candidate must identify:

- an actor or principal capable of initiating the path;
- the specific protected asset, action, or security boundary;
- source locations and the conditions that make the path reachable;
- the control expected to stop it and the evidence that control fails or is missing;
- the concrete observed or logically bounded consequence;
- a minimal source-grounded reproduction plan and a targeted regression test.

Do not report checklist deviations, theoretical impact, self-impact, intended same-principal authority, missing defense-in-depth, or an untested configuration assumption as a verified vulnerability. A fix suggestion is not evidence that the bug exists.

## Phase D — Adversarial verification

Every unique candidate receives a fresh verification pass that did not produce the original hypothesis. Ask the verifier to disprove the claim: re-trace current source, challenge reachability and actor capability, identify intervening controls, check whether evidence is stale, and test whether the alleged result exceeds what the code establishes. Preserve the original claim, counter-evidence, and resulting decision.

Use only these dispositions:

- **`verified`** — exact current-source trace, reachable conditions, a demonstrated bounded result, concrete security consequence, and an independent challenge support the claim.
- **`unresolved`** — the source supports a plausible hypothesis but a named fact is missing; state the next safe check. Do not assign severity.
- **`disproved`** — current source or bounded local evidence contradicts the claim; record the decisive reason so the same rejected claim is not rediscovered unchanged.

A verified record must include repository-relative file paths and line ranges, preconditions, reproduction steps and observed result where execution is safe, an independent verifier's reasoning, the invariant to restore, a narrow fix, and a regression test. When a decisive result is external or sandbox controls are unavailable, keep it `unresolved`; do not substitute confidence language for evidence.

## Phase E — Assess priority and write records

Assign severity only to `verified` records, based on demonstrated impact and plausible reachability—not on how surprising the code looks. Use these anchors:

- **critical:** a broadly reachable unauthenticated path yields code execution, unrestricted sensitive-store access, or arbitrary account takeover;
- **high:** a real attacker defeats a strong access-control boundary with material consequences, such as cross-tenant access or authenticated remote code execution;
- **medium:** a concrete boundary failure has restricted scope, uncommon preconditions, or limited blast radius;
- **low:** confirmed, narrow disclosure or low-impact manipulation;
- **info:** a confirmed minimal-impact fact relevant mainly as a prerequisite or supporting observation.

If the concrete damage cannot be stated, lower priority or keep the candidate unresolved. Prefer a minimal source change at the last trusted decision point over broad refactoring. Give a concrete regression assertion that fails before the fix and passes after it.

Write a machine-readable report and derive human-readable reports from that data. Keep records consistent; prose must not assert findings missing from the structured report. If a report validator is packaged and available on disk, run it and preserve its actual result. If it is unavailable, say that validation was not executed.

Recommended outputs in the run directory:

- `run.json` — run state, scope, source revision, and execution policy;
- `system-map.md` — observed architecture and trust boundaries;
- `coverage.json` — review-unit ledger and unexamined areas;
- `report.json` — verified, unresolved, and disproved records;
- `REPORT.md`, `FINDINGS.md`, `NEEDS-VALIDATION.md` — generated views of the structured records.

Before concluding, verify that each `verified` record has independent review, source evidence, bounded impact, and a testable fix; each `unresolved` record names its blocker and has no severity; each `disproved` record identifies contrary evidence; the ledger and report agree; and the run status truthfully reflects incomplete phases. State the reviewed revision, scope, real tests executed, important exclusions, and residual unknowns. Never claim one run exhausts the target.
