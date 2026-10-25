---
name: security-test-plan
description: Design bounded local reproductions and regression tests for an authorized security finding, including fixtures, assertions, test isolation, cleanup, and limits when execution is not safe.
---

# Security Test Plan

Design a test that distinguishes the vulnerable behavior from the required security invariant. This skill plans safe local validation; it does not itself authorize probing deployed systems or modifying the target implementation.

## Build a falsifiable test

1. Read the finding and current source. Confirm the path, relevant trust boundary, exact entry point, and source revision. Challenge the finding before encoding it into a test.
2. Define a synthetic actor, a protected resource, controlled inputs, and the security invariant. Use dummy tenants, accounts, tokens, files, and secrets.
3. Write one regression test that fails for the alleged vulnerable behavior and passes only when the boundary is enforced. Add a negative-control test for valid behavior so a proposed fix does not simply disable the feature.
4. Specify test fixtures, deterministic setup, expected status/exception/output, cleanup, timing limits, and how results should be recorded. Keep each test narrow and repeatable.
5. Prefer the existing test framework and already installed dependencies. Do not install packages or download fixtures during an audit run. Do not fuzz or stress a shared environment.
6. If a test requires external infrastructure, a real identity, or unavailable sandbox controls, mark it blocked and supply a local fixture or owner-observed validation plan instead of executing it.

## Mandatory execution boundary

Execute target-controlled tests, package scripts, processes, browser flows, or fixture parsing only in an OS-enforced sandbox with external networking disabled (loopback only when required), a safe allowlisted environment, read-only source/toolchain, an isolated scratch directory, and explicit resource limits. No credentials, host sockets, shared services, production data, or retained reports may be reachable from the test process. If any control is missing, do not run the test.

Do not mutate target source in an audit workflow. Present the minimal change and test patch as a proposal unless the user separately authorizes implementation. Never claim a test ran when you only described it.

## Deliverable

Return the test objective, threat preconditions, fixture design, exact assertion, negative control, expected vulnerable and fixed outcomes, run command when safe, cleanup, sandbox requirements, and interpretation limits. Link the proposed assertion to the specific source evidence and to the finding identifier. Record test results separately from static reasoning; passing a regression test does not prove the whole system secure.
