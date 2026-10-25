import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject, name } from '../src/index.js'

test('exports the native DSH plugin contract', () => {
  assert.equal(name, 'dsh-cf-audit')
  assert.deepEqual(inject, ['skills'])
  assert.throws(() => apply({}), /requires the DeepSeek Harness skills service/)
})

test('registers three discoverable skills and loads their instruction bodies', async () => {
  let factory
  apply({ skills: { registerProvider(value) { factory = value } } })
  assert.equal(typeof factory, 'function')
  const provider = factory()
  assert.equal(provider.name, 'dsh-cf-audit')

  const candidates = await provider.list({})
  assert.deepEqual(candidates.map((item) => item.name), [
    'security-audit', 'security-triage', 'security-test-plan',
  ])
  for (const item of candidates) {
    assert.equal(item.provider, 'dsh-cf-audit')
    assert.equal(item.source, 'bundled')
    assert.equal(item.invocation.modelInvocable, true)
    assert.equal(item.invocation.userInvocable, true)
    assert.ok(Number.isFinite(item.rank))
    assert.ok(item.description.length > 20)
    const definition = await provider.get(item)
    assert.equal(definition.name, item.name)
    assert.ok(definition.content.length > 1000)
    assert.doesNotMatch(definition.content, /^---\s*\n/m)
  }
})

test('does not load a candidate outside the provider catalog', async () => {
  let provider
  apply({ skills: { registerProvider(value) { provider = value() } } })
  assert.equal(await provider.get({ name: '../unexpected' }), undefined)
})
