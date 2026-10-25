#!/usr/bin/env node
import { readFile, readdir, lstat, access } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { validateCoverageData } from './validate-coverage.mjs'
import { validateReportData } from './validate-report.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const errors = []
const requiredFiles = [
  'package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md',
  'cordis.patch.yml', 'src/index.js', 'scripts/validate-report.mjs',
  'scripts/validate-coverage.mjs', 'scripts/render-report.mjs',
  'scripts/package-release.py', 'assets/icon.svg', 'assets/logo-light.svg', 'assets/logo-dark.svg',
  'skills/security-audit/SKILL.md', 'skills/security-triage/SKILL.md',
  'skills/security-test-plan/SKILL.md', 'docs/templates/report.example.json',
  'docs/templates/coverage.example.json',
]
const fail = (message) => errors.push(message)
const read = (path) => readFile(join(root, path), 'utf8')
const exists = async (path) => access(join(root, path)).then(() => true, () => false)

async function walk(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    const rel = relative(root, abs).split('\\').join('/')
    if (entry.isSymbolicLink()) { fail(`symlink is not allowed: ${rel}`); continue }
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '__pycache__', 'coverage'].includes(entry.name)) { fail(`transient or repository directory found: ${rel}`); continue }
      found.push(...await walk(abs))
    } else if (entry.isFile()) {
      if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name.endsWith('.pyc')) fail(`transient file found: ${rel}`)
      if (/^(\.env(\..*)?|\.npmrc|id_rsa|id_ed25519|credentials\.json|secrets\.ya?ml)$/i.test(entry.name)) fail(`secret-shaped file found: ${rel}`)
      found.push(rel)
    }
  }
  return found
}

async function main() {
  for (const path of requiredFiles) if (!(await exists(path))) fail(`required file is missing: ${path}`)

  let pkg
  try { pkg = JSON.parse(await read('package.json')) } catch (e) { fail(`package.json is invalid: ${e.message}`) }
  if (pkg) {
    if (pkg.name !== 'dsh-cf-audit') fail('package.json name must be dsh-cf-audit')
    if (pkg.version !== '0.1.0') fail('package.json version does not match the current release: 0.1.0')
    if (pkg.author !== 'mulqizamzam') fail('package.json author must be mulqizamzam')
    if (pkg.license !== 'MIT') fail('package.json must declare the project license')
    if (pkg.type !== 'module' || pkg.main !== './src/index.js') fail('package.json must use the reviewed ESM entry point')
    if (pkg.engines?.node !== '^22.19.0 || >=24.0.0') fail('package.json must match the Node compatibility range of the requested DSH runtime')
    if (pkg.engines?.dsh !== '>=0.2.1-rc.2 <0.2.1-rc.3') fail('package.json must be restricted to the requested DSH 0.2.1-rc.2 release line')
    if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch must point to ./cordis.patch.yml')
    if (!pkg.scripts?.test?.includes('node --test')) fail('package.json must expose the built-in Node test runner')
    if (Object.keys(pkg.dependencies ?? {}).length) fail('unexpected runtime dependencies are not permitted without review')
  }

  for (const name of ['security-audit', 'security-triage', 'security-test-plan']) {
    const path = `skills/${name}/SKILL.md`
    if (!(await exists(path))) continue
    const content = await read(path)
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
    if (!match) { fail(`${path} has no YAML frontmatter`); continue }
    if (!new RegExp(`^name:\\s*${name}\\s*$`, 'm').test(match[1])) fail(`${path} skill name must match its directory`)
    if (!/^description:\s*\S.+$/m.test(match[1])) fail(`${path} needs a non-empty description`)
    if (content.slice(match[0].length).trim().length < 1000) fail(`${path} appears too short to contain a complete workflow`)
    if (!/authorized|authorization/i.test(content)) fail(`${path} must state an authorization boundary`)
  }

  const patch = (await read('cordis.patch.yml')).replace(/\r\n/g, '\n')
  if (!patch.includes('- insert:') || !/id:\s*dsh-cf-audit\b/.test(patch) || !/name:\s*dsh-cf-audit\b/.test(patch)) fail('bundle patch must insert the dsh-cf-audit module')
  if (/\.\.[/\\]/.test(patch)) fail('bundle patch must not contain parent-directory traversal')

  const icon = await read('assets/icon.svg')
  if (!/<svg\b/.test(icon) || !/viewBox="0 0 128 128"/.test(icon)) fail('icon.svg must be an SVG with a square viewBox')
  if (/<script\b|(?:href|src)\s*=\s*['\"]https?:\/\/|xlink:href|<!DOCTYPE|url\(\s*['\"]?https?:/i.test(icon)) fail('icon.svg must not contain scripts, external resources, or a document type')
  const logoLight = await read('assets/logo-light.svg')
  const logoDark = await read('assets/logo-dark.svg')
  if (!/viewBox="0 0 320 96"/.test(logoLight) || !/viewBox="0 0 320 96"/.test(logoDark)) fail('light and dark logo lockups must share the same viewBox')

  const report = JSON.parse(await read('docs/templates/report.example.json'))
  const reportErrors = validateReportData(report)
  reportErrors.forEach(e => fail(`report template: ${e}`))
  const coverage = JSON.parse(await read('docs/templates/coverage.example.json'))
  const coverageErrors = validateCoverageData(coverage)
  coverageErrors.forEach(e => fail(`coverage template: ${e}`))

  const files = await walk(root)
  const banned = /(?:^|\/)\.env(?:\.|$)|\.pem$|\.p12$|\.key$/i
  for (const path of files) if (banned.test(path)) fail(`secret-shaped path found: ${path}`)

  if (errors.length) {
    console.error(`Package preflight failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`)
    errors.forEach(e => console.error(`- ${e}`))
    process.exitCode = 1
    return
  }
  console.log(`Package preflight passed: ${files.length} regular files, 3 skill workflows, 0 runtime dependencies.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
