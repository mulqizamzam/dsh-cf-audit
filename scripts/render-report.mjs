#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateReportData } from './validate-report.mjs'

const esc = (v) => String(v ?? '').replaceAll('\r', '').trim()
const bullets = (items) => items?.length ? items.map(x => `- ${esc(x)}`).join('\n') : '- Not recorded.'
const sourceRefs = (f) => (f.evidence ?? []).map(e => `- \`${esc(e.path)}:${e.lineStart}-${e.lineEnd}\` — ${esc(e.relevance)}\n  > ${esc(e.excerpt).replaceAll('\n', '\n  > ')}`).join('\n')
const sorted = (items) => [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)))

function reportMarkdown(report) {
  const counts = { verified: 0, unresolved: 0, disproved: 0 }
  for (const f of report.findings) counts[f.disposition] += 1
  const r = report.run
  return `# Security Review Report\n\n- **Run:** \`${r.id}\`\n- **Repository:** ${esc(r.repository)}\n- **Reviewed revision:** \`${esc(r.sourceRef)}\`\n- **Mode:** ${esc(r.mode)}\n- **Run state:** ${esc(r.status)}\n- **Execution policy:** ${esc(r.executionPolicy)}\n- **Scope:** ${r.scopePaths.map(p => `\`${esc(p)}\``).join(', ') || 'Not recorded'}\n- **Finished:** ${esc(r.completedAt ?? 'Not completed')}\n\n## Summary\n\n${esc(report.summary)}\n\n## Finding counts\n\n| Disposition | Count |\n|---|---:|\n| Verified | ${counts.verified} |\n| Unresolved | ${counts.unresolved} |\n| Disproved | ${counts.disproved} |\n\n## Coverage and limitations\n\n- **Coverage claim:** ${esc(report.coverage.status)}\n- **Ledger units:** ${report.coverage.unitIds.map(x => `\`${esc(x)}\``).join(', ') || 'None recorded'}\n\n${bullets(report.coverage.knownGaps)}\n\n## Findings\n\n${sorted(report.findings).map(f => `### ${esc(f.id)} — ${esc(f.title)}\n\n- **Disposition:** ${esc(f.disposition)}\n${f.severity ? `- **Severity:** ${esc(f.severity)}\n` : ''}\n${esc(f.summary)}\n\n**Affected paths**\n\n${bullets(f.affectedPaths)}\n\n**Source evidence**\n\n${sourceRefs(f) || 'No evidence supplied.'}\n\n${f.disposition === 'verified' ? `**Impact**\n\n${esc(f.impact)}\n\n**Attack path**\n\n${esc(f.attackPath)}\n\n**Remediation**\n\n${esc(f.remediation)}\n\n**Regression tests**\n\n${bullets(f.regressionTests)}\n\n**Independent verification**\n\n${esc(f.verifier.rationale)}\n` : f.disposition === 'unresolved' ? `**Blocker**\n\n${esc(f.blocker)}\n\n**Next safe step**\n\n${esc(f.nextStep)}\n` : `**Reason rejected**\n\n${esc(f.rejectionReason)}\n`}`).join('\n---\n\n') || 'No finding records were supplied.'}\n\n## Interpretation limits\n\nThis report reflects the cited source revision, declared scope, and recorded methods only. An empty finding list or reviewed coverage units do not prove that the entire system is secure.\n`
}

function findingsMarkdown(report) {
  const items = sorted(report.findings.filter(f => f.disposition !== 'unresolved'))
  return `# Findings\n\n${items.map(f => `## ${esc(f.id)} — ${esc(f.title)}\n\n- **Disposition:** ${esc(f.disposition)}\n${f.severity ? `- **Severity:** ${esc(f.severity)}\n` : ''}\n${esc(f.summary)}\n\n**Evidence**\n\n${sourceRefs(f) || 'No evidence supplied.'}\n\n${f.disposition === 'verified' ? `**Impact:** ${esc(f.impact)}\n\n**Remediation:** ${esc(f.remediation)}\n\n**Regression tests:**\n\n${bullets(f.regressionTests)}\n` : `**Reason rejected:** ${esc(f.rejectionReason)}\n`}`).join('\n---\n\n') || 'No verified or disproved findings.'}\n`
}

function unresolvedMarkdown(report) {
  const items = sorted(report.findings.filter(f => f.disposition === 'unresolved'))
  return `# Needs Validation\n\n${items.map(f => `## ${esc(f.id)} — ${esc(f.title)}\n\n${esc(f.summary)}\n\n**Evidence**\n\n${sourceRefs(f) || 'No evidence supplied.'}\n\n**Blocker**\n\n${esc(f.blocker)}\n\n**Next safe step**\n\n${esc(f.nextStep)}\n`).join('\n---\n\n') || 'No unresolved findings.'}\n`
}

async function main() {
  let reportPath
  let outDir
  const args = process.argv.slice(2)
  if (args.length === 3 && args[1] === '--out-dir') {
    [reportPath, , outDir] = args
  } else {
    console.error('Usage: node scripts/render-report.mjs <report.json> --out-dir <existing-directory>')
    process.exitCode = 2
    return
  }
  try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'))
    const errors = validateReportData(report)
    if (errors.length) {
      console.error(`Refusing to render invalid report (${errors.length} issue(s)):`)
      errors.forEach(e => console.error(`- ${e}`))
      process.exitCode = 1
      return
    }
    const target = resolve(outDir)
    const info = await stat(target)
    if (!info.isDirectory()) throw new Error('output path must be an existing directory')
    if ((await readdir(target)).length !== 0) throw new Error('output directory must be empty; refusing to overwrite existing files')
    const outputs = [
      ['REPORT.md', reportMarkdown(report)],
      ['FINDINGS.md', findingsMarkdown(report)],
      ['NEEDS-VALIDATION.md', unresolvedMarkdown(report)],
    ]
    for (const [name, content] of outputs) await writeFile(join(target, name), content, { flag: 'wx', encoding: 'utf8' })
    console.log(`Rendered ${outputs.length} Markdown reports to ${target}.`)
  } catch (error) {
    console.error(`Could not render reports: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
