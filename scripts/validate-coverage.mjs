#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STATUSES = new Set(['planned', 'active', 'candidate', 'reviewed', 'blocked', 'excluded'])
const PRIORITIES = new Set(['high', 'normal', 'low'])
const TERMINAL = new Set(['reviewed', 'excluded'])

export function validateCoverageData(value) {
  const errors = []
  const err = (path, message) => errors.push(`${path}: ${message}`)
  const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  const nonempty = (v) => typeof v === 'string' && v.trim().length > 0
  const arr = (v) => Array.isArray(v)
  const safeRelPath = (v) => nonempty(v) && !v.includes('\\') && !v.startsWith('/') && !/^[A-Za-z]:/.test(v)
    && v.split('/').every((part) => part !== '' && part !== '.' && part !== '..')

  if (!obj(value)) return ['$: expected a JSON object']
  if (value.schemaVersion !== 1) err('schemaVersion', 'must equal 1')
  if (!obj(value.repository)) err('repository', 'must be an object')
  else {
    if (!safeRelPath(value.repository.path)) err('repository.path', 'must identify a safe relative or workspace alias, not an absolute path')
    if (!nonempty(value.repository.revision)) err('repository.revision', 'must identify the reviewed source revision')
    if (typeof value.repository.dirty !== 'boolean') err('repository.dirty', 'must be a boolean')
  }
  if (!obj(value.scope)) err('scope', 'must be an object')
  else {
    if (!arr(value.scope.includedPaths) || !value.scope.includedPaths.every(safeRelPath)) err('scope.includedPaths', 'must contain safe relative paths')
    if (!arr(value.scope.excludedPaths) || !value.scope.excludedPaths.every(safeRelPath)) err('scope.excludedPaths', 'must contain safe relative paths')
    if (!nonempty(value.scope.authorization)) err('scope.authorization', 'must summarize the authorization boundary')
    if (!arr(value.scope.limitations) || !value.scope.limitations.every(nonempty)) err('scope.limitations', 'must be an array of limitations')
  }
  if (!['partial', 'declared-scope-reviewed'].includes(value.claim)) err('claim', 'must be partial or declared-scope-reviewed')
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) err('updatedAt', 'must be a parseable date-time')
  if (!arr(value.units) || value.units.length === 0) err('units', 'must contain at least one review unit')
  else {
    const ids = new Set()
    value.units.forEach((unit, i) => {
      const p = `units[${i}]`
      if (!obj(unit)) { err(p, 'must be an object'); return }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(unit.id ?? '')) err(`${p}.id`, 'must be a unique lowercase hyphenated identifier')
      if (ids.has(unit.id)) err(`${p}.id`, 'must be unique')
      ids.add(unit.id)
      if (!nonempty(unit.surface)) err(`${p}.surface`, 'must name the security surface')
      if (!arr(unit.paths) || unit.paths.length === 0 || !unit.paths.every(safeRelPath)) err(`${p}.paths`, 'must contain at least one safe repository-relative path')
      if (!PRIORITIES.has(unit.priority)) err(`${p}.priority`, 'must be high, normal, or low')
      if (!STATUSES.has(unit.status)) err(`${p}.status`, 'must use a supported review state')
      if (!arr(unit.checks) || !unit.checks.every(nonempty)) err(`${p}.checks`, 'must be an array of planned or completed checks')
      if (unit.status === 'reviewed' && (!arr(unit.checks) || unit.checks.length === 0)) err(`${p}.checks`, 'reviewed units must record at least one completed check')
      if (unit.status === 'blocked' && !nonempty(unit.blocker)) err(`${p}.blocker`, 'blocked units must name the exact blocker')
      if (unit.status === 'excluded' && !nonempty(unit.exclusionReason)) err(`${p}.exclusionReason`, 'excluded units must state why they are out of scope')
      if (unit.status !== 'blocked' && 'blocker' in unit && !nonempty(unit.blocker)) err(`${p}.blocker`, 'must be non-empty when supplied')
    })
    if (value.claim === 'declared-scope-reviewed' && value.units.some((unit) => !obj(unit) || !TERMINAL.has(unit.status))) {
      err('claim', 'declared-scope-reviewed requires every listed unit to be reviewed or explicitly excluded')
    }
    if (value.claim === 'declared-scope-reviewed' && value.units.some((unit) => obj(unit) && unit.status === 'excluded' && !nonempty(unit.exclusionReason))) {
      err('claim', 'cannot mark declared scope reviewed when an excluded unit lacks a reason')
    }
  }
  return errors
}

async function main() {
  const path = process.argv[2]
  if (!path || process.argv.length !== 3) {
    console.error('Usage: node scripts/validate-coverage.mjs <coverage.json>')
    process.exitCode = 2
    return
  }
  try {
    const value = JSON.parse(await readFile(path, 'utf8'))
    const errors = validateCoverageData(value)
    if (errors.length) {
      console.error(`Invalid coverage ledger (${errors.length} issue${errors.length === 1 ? '' : 's'}):`)
      for (const error of errors) console.error(`- ${error}`)
      process.exitCode = 1
      return
    }
    console.log(`Valid coverage ledger: ${value.units.length} review unit(s), claim ${value.claim}.`)
  } catch (error) {
    console.error(`Could not validate coverage ledger: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
