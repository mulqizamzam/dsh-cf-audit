import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateReportData } from '../scripts/validate-report.mjs'
import { validateCoverageData } from '../scripts/validate-coverage.mjs'

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

test('example report and coverage ledger satisfy their schemas', async () => {
  assert.deepEqual(validateReportData(await readJson('../docs/templates/report.example.json')), [])
  assert.deepEqual(validateCoverageData(await readJson('../docs/templates/coverage.example.json')), [])
})

test('unresolved findings cannot carry severity and need a bounded next step', async () => {
  const report = await readJson('../docs/templates/report.example.json')
  report.findings = [{
    id: 'AUD-001', disposition: 'unresolved', title: 'Example hypothesis',
    summary: 'A source-grounded possibility has not been established.',
    affectedPaths: ['src/auth'],
    evidence: [{ path: 'src/auth/route.js', lineStart: 10, lineEnd: 12, excerpt: 'authorize(subject, resource)', relevance: 'This is the decision point to inspect.' }],
    severity: 'high', blocker: 'A required configuration fact is unavailable.',
    nextStep: 'Review the named configuration in the authorized local environment.',
  }]
  assert.ok(validateReportData(report).some((error) => error.includes('severity: must be omitted')))
  delete report.findings[0].severity
  assert.deepEqual(validateReportData(report), [])
})

test('coverage cannot claim declared-scope review while a unit remains planned', async () => {
  const ledger = await readJson('../docs/templates/coverage.example.json')
  ledger.claim = 'declared-scope-reviewed'
  assert.ok(validateCoverageData(ledger).some((error) => error.includes('requires every listed unit')))
})

test('verified findings require independent verification and a reproducible observed result', async () => {
  const report = await readJson('../docs/templates/report.example.json')
  report.findings = [{
    id: 'AUD-001', disposition: 'verified', severity: 'medium', title: 'Example finding',
    summary: 'Illustrative only; not an actual vulnerability claim.', affectedPaths: ['src/auth'],
    evidence: [{ path: 'src/auth/route.js', lineStart: 10, lineEnd: 12, excerpt: 'return access(resource)', relevance: 'Example decision point.' }],
    attackPath: 'An unauthorized synthetic principal reaches the protected operation.',
    impact: 'The local fixture returns one protected dummy record.', remediation: 'Enforce the authorization predicate at the final decision point.',
    reproduction: { preconditions: ['Local fixture only.'], steps: ['Send a synthetic unauthorized principal.'], observedResult: 'The fixture returns the dummy record.' },
    regressionTests: ['The same request is rejected after the fix.'],
    verifier: { independent: true, rationale: 'A separate reviewer traced the control and reproduced the bounded result.' },
  }]
  assert.deepEqual(validateReportData(report), [])
  delete report.findings[0].verifier
  assert.ok(validateReportData(report).some((error) => error.includes('verifier: must document an independent verification pass')))
})
