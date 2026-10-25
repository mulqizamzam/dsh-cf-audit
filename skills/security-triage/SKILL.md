---
name: security-triage
description: Investigate a focused security question or suspected code vulnerability by tracing source, challenging assumptions, and classifying the claim as verified, unresolved, or disproved without automatically launching a full audit.
---

# Security Triage

Use this skill for one suspected vulnerability, a narrow set of files, a security design question grounded in a repository, or review of a proposed finding. Do not automatically create a full audit run or broad report suite.

## Method

1. Restate the security claim in falsifiable terms: which actor can do what to which protected resource, under which conditions?
2. Read the relevant implementation and its callers, guards, configuration, tests, and downstream sinks. Record the current revision and dirty state if repository history is available.
3. Trace untrusted input and principal identity from entry to the final authorization or validation decision. Read enough surrounding code to identify alternate paths and intervening controls; a single suspicious line is not sufficient.
4. Try to disprove the claim. Check input normalization, canonicalization, permission checks, tenant binding, error paths, transaction/locking behavior, and whether the alleged effect is actually reachable.
5. Select one disposition:
   - `verified`: current source and bounded evidence establish the path and concrete impact;
   - `unresolved`: a named fact is missing and would change the conclusion;
   - `disproved`: current source or a safe local test contradicts the claim.
6. Return file/line evidence, assumptions, confidence basis, impact boundaries, and the smallest useful next step. Keep likelihood, impact, and evidence quality distinct.

## Evidence and safety rules

Do not execute target-controlled code unless the required OS-enforced isolation is available: networking disabled, sanitized allowlisted environment, read-only source/toolchain, isolated scratch-only writes, and strict resource limits. Do not probe deployed endpoints, use real credentials, or test another user's data. If execution is blocked, give the safe local reproduction plan and classify the claim as unresolved rather than implying the test passed.

Only a `verified` claim may receive a severity, and it must be tied to demonstrated impact. A missing second layer of defense is not a vulnerability if an earlier control prevents the attack. Avoid generic scanner output, CWE-only labels, and speculative impact chains without a reachable source trace.

## Response shape

Provide: disposition, concise claim, affected principal/resource, source evidence, attack preconditions/path, demonstrated or unresolved consequence, counter-evidence, severity only when verified, narrow remediation, regression-test idea, and residual unknowns. For `unresolved`, explicitly name the missing fact and the safe observation that would settle it. Do not create or modify files unless the user requested artifacts.
