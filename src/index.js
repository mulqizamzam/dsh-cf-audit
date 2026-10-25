import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** Native DeepSeek Harness plugin providing defensive security workflows. */
export const name = 'dsh-cf-audit'
export const inject = ['skills']

const PROVIDER_NAME = 'dsh-cf-audit'
const SKILL_ROOT_URL = new URL('../skills/', import.meta.url)
const INVOCATION = Object.freeze({ modelInvocable: true, userInvocable: true })

const SKILLS = [
  {
    name: 'security-audit',
    description: 'Run a scoped, multi-stage defensive security review of a local codebase when the user explicitly requests a full audit, comprehensive review, authorized penetration test of local code, or structured report artifacts.',
    url: new URL('security-audit/SKILL.md', SKILL_ROOT_URL),
  },
  {
    name: 'security-triage',
    description: 'Investigate a focused security question or suspected code vulnerability by tracing source, challenging assumptions, and classifying the claim as verified, unresolved, or disproved without automatically launching a full audit.',
    url: new URL('security-triage/SKILL.md', SKILL_ROOT_URL),
  },
  {
    name: 'security-test-plan',
    description: 'Design bounded local reproductions and regression tests for an authorized security finding, including fixtures, assertions, test isolation, cleanup, and limits when execution is not safe.',
    url: new URL('security-test-plan/SKILL.md', SKILL_ROOT_URL),
  },
].map((skill, index) => Object.freeze({
  ...skill,
  resourceBase: Object.freeze({ kind: 'directory', path: dirname(fileURLToPath(skill.url)) }),
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  rank: 600 + index,
  path: fileURLToPath(skill.url),
  locator: skill.url,
}))

const provider = Object.freeze({
  name: PROVIDER_NAME,

  list() {
    return Promise.resolve(SKILLS)
  },

  async get(candidate, options = {}) {
    const skill = SKILLS.find((entry) => entry.name === candidate?.name)
    if (!skill) return undefined
    const raw = await readFile(skill.url, { encoding: 'utf8', signal: options.signal })
    const match = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n/)
    if (!match) throw new Error(`Skill ${skill.name} is missing YAML frontmatter`)
    return {
      name: skill.name,
      description: skill.description,
      invocation: skill.invocation,
      provider: skill.provider,
      source: skill.source,
      resourceBase: skill.resourceBase,
      path: skill.path,
      content: raw.slice(match[0].length),
    }
  },
})

/** Register the bundled audit workflows with the host-provided DSH skill service. */
export function apply(ctx) {
  if (!ctx?.skills || typeof ctx.skills.registerProvider !== 'function') {
    throw new TypeError('dsh-cf-audit requires the DeepSeek Harness skills service')
  }
  ctx.skills.registerProvider(() => provider)
}

export default { name, inject, apply }
