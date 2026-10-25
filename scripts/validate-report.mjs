#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info'])
const DISPOSITIONS = new Set(['verified', 'unresolved', 'disproved'])
const EXECUTION_POLICIES = new Set(['source-review-only', 'isolated-local-validation'])

export function validateReportData(value) {
  const errors = []
  const err = (path, message) => errors.push(`${path}: ${message}`)
  const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  const nonempty = (v) => typeof v === 'string' && v.trim().length > 0
  const arr = (v) => Array.isArray(v)
  const positiveInt = (v) => Number.isInteger(v) && v > 0
  const validTime = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d\d-\d\dT/.test(v)
  const safeRelPath = (v) => {
    if (!nonempty(v) || v.includes('\\') || v.startsWith('/') || /^[A-Za-z]:/.test(v)) return false
    const parts = v.split('/')
    return parts.every((part) => part !== '' && part !== '.' && part !== '..')
  }
  const stringArray = (v) => arr(v) && v.every(nonempty)

  if (!obj(value)) return ['$: expected a JSON object']
  if (value.schemaVersion !== 1) err('schemaVersion', 'must equal 1')
  if (!obj(value.run)) err('run', 'must be an object')
  else {
    const r = value.run
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(r.id ?? '')) err('run.id', 'must be a lowercase run identifier')
    if (!nonempty(r.repository)) err('run.repository', 'must be a non-empty string')
    if (!nonempty(r.sourceRef)) err('run.sourceRef', 'must identify the reviewed source revision')
    if (!validTime(r.startedAt)) err('run.startedAt', 'must be an ISO date-time')
    if (r.completedAt !== null && !validTime(r.completedAt)) err('run.completedAt', 'must be null or an ISO date-time')
    if (!['full', 'scoped'].includes(r.mode)) err('run.mode', 'must be full or scoped')
    if (!['complete', 'incomplete'].includes(r.status)) err('run.status', 'must be complete or incomplete')
    if (r.status === 'complete' && r.completedAt === null) err('run.completedAt', 'is required for a complete run')
    if (!EXECUTION_POLICIES.has(r.executionPolicy)) err('run.executionPolicy', 'must be source-review-only or isolated-local-validation')
    if (!arr(r.scopePaths) || !r.scopePaths.every(safeRelPath)) err('run.scopePaths', 'must be an array of safe repository-relative paths')
  }
  if (!nonempty(value.summary)) err('summary', 'must be a non-empty string')

  if (!obj(value.coverage)) err('coverage', 'must be an object')
  else {
    const c = value.coverage
    if (!['partial', 'declared-scope-reviewed'].includes(c.status)) err('coverage.status', 'must be partial or declared-scope-reviewed')
    if (!arr(c.unitIds) || !c.unitIds.every(nonempty)) err('coverage.unitIds', 'must be an array of unit identifiers')
    if (!arr(c.knownGaps) || !c.knownGaps.every(nonempty)) err('coverage.knownGaps', 'must be an array of limitation strings')
    if (c.status === 'partial' && arr(c.knownGaps) && c.knownGaps.length === 0) err('coverage.knownGaps', 'partial coverage must name at least one known gap')
  }

  if (!arr(value.findings)) err('findings', 'must be an array')
  else {
    const seen = new Set()
    value.findings.forEach((f, i) => {
      const p = `findings[${i}]`
      if (!obj(f)) { err(p, 'must be an object'); return }
      if (!/^AUD-\d{3,}$/.test(f.id ?? '')) err(`${p}.id`, 'must match AUD-001 or a higher sequence')
      if (seen.has(f.id)) err(`${p}.id`, 'must be unique')
      seen.add(f.id)
      if (!DISPOSITIONS.has(f.disposition)) err(`${p}.disposition`, 'must be verified, unresolved, or disproved')
      if (!nonempty(f.title)) err(`${p}.title`, 'must be a non-empty string')
      if (!nonempty(f.summary)) err(`${p}.summary`, 'must be a non-empty string')
      if (!arr(f.affectedPaths) || !f.affectedPaths.every(safeRelPath)) err(`${p}.affectedPaths`, 'must contain safe repository-relative paths')
      if (!arr(f.evidence) || f.evidence.length === 0) err(`${p}.evidence`, 'must contain at least one source evidence record')
      else f.evidence.forEach((e, j) => {
        const ep = `${p}.evidence[${j}]`
        if (!obj(e)) { err(ep, 'must be an object'); return }
        if (!safeRelPath(e.path)) err(`${ep}.path`, 'must be a safe repository-relative path')
        if (!positiveInt(e.lineStart)) err(`${ep}.lineStart`, 'must be a positive integer')
        if (!positiveInt(e.lineEnd) || (positiveInt(e.lineStart) && positiveInt(e.lineEnd) && e.lineEnd < e.lineStart)) err(`${ep}.lineEnd`, 'must be a positive integer at least lineStart')
        if (!nonempty(e.excerpt)) err(`${ep}.excerpt`, 'must contain a short, relevant source excerpt')
        if (!nonempty(e.relevance)) err(`${ep}.relevance`, 'must explain why the lines matter')
      })
      if (f.disposition === 'verified') {
        if (!SEVERITIES.has(f.severity)) err(`${p}.severity`, 'is required for verified findings and must use the supported scale')
        if (!nonempty(f.attackPath)) err(`${p}.attackPath`, 'must describe a reachable path and relevant preconditions')
        if (!nonempty(f.impact)) err(`${p}.impact`, 'must state a concrete, bounded security consequence')
        if (!nonempty(f.remediation)) err(`${p}.remediation`, 'must propose a narrow effective fix')
        if (!obj(f.reproduction)) err(`${p}.reproduction`, 'is required for verified findings')
        else {
          if (!stringArray(f.reproduction.preconditions)) err(`${p}.reproduction.preconditions`, 'must be an array of preconditions')
          if (!stringArray(f.reproduction.steps) || f.reproduction.steps.length === 0) err(`${p}.reproduction.steps`, 'must contain at least one reproducible step')
          if (!nonempty(f.reproduction.observedResult)) err(`${p}.reproduction.observedResult`, 'must state the bounded observed result')
        }
        if (!arr(f.regressionTests) || f.regressionTests.length === 0 || !f.regressionTests.every(nonempty)) err(`${p}.regressionTests`, 'must contain at least one concrete regression assertion')
        if (!obj(f.verifier) || f.verifier.independent !== true || !nonempty(f.verifier.rationale)) err(`${p}.verifier`, 'must document an independent verification pass and its rationale')
      } else if (f.disposition === 'unresolved') {
        if ('severity' in f) err(`${p}.severity`, 'must be omitted for unresolved findings')
        if (!nonempty(f.blocker)) err(`${p}.blocker`, 'must identify the exact missing fact or capability')
        if (!nonempty(f.nextStep)) err(`${p}.nextStep`, 'must state the next safe validation step')
      } else if (f.disposition === 'disproved') {
        if ('severity' in f) err(`${p}.severity`, 'must be omitted for disproved findings')
        if (!nonempty(f.rejectionReason)) err(`${p}.rejectionReason`, 'must identify the decisive contrary evidence')
      }
      if (f.fingerprint !== undefined && !nonempty(f.fingerprint)) err(`${p}.fingerprint`, 'must be non-empty when supplied')
    })
  }
  return errors
}

async function main() {
  const path = process.argv[2]
  if (!path || process.argv.length !== 3) {
    console.error('Usage: node scripts/validate-report.mjs <report.json>')
    process.exitCode = 2
    return
  }
  try {
    const value = JSON.parse(await readFile(path, 'utf8'))
    const errors = validateReportData(value)
    if (errors.length) {
      console.error(`Invalid report (${errors.length} issue${errors.length === 1 ? '' : 's'}):`)
      for (const error of errors) console.error(`- ${error}`)
      process.exitCode = 1
      return
    }
    console.log(`Valid report: ${value.findings.length} finding record(s), run ${value.run.id}.`)
  } catch (error) {
    console.error(`Could not validate report: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
