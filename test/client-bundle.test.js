import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadBundle() {
  const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let descriptor
  vm.runInNewContext(code, {
    console,
    window: {
      __ModuleLoader__: {
        load(value) { descriptor = value },
      },
    },
  })
  assert.equal(descriptor?.id, 'dsh-model-mgr')
  assert.equal(typeof descriptor?.factory, 'function')
  const plugin = descriptor.factory((specifier) => {
    if (specifier === 'react') return {}
    throw new Error(`unexpected dynamic dependency: ${specifier}`)
  })
  return { code, plugin }
}

test('client bundle loads and registers primary plus compatibility settings entries', async () => {
  const { plugin } = await loadBundle()
  assert.equal(typeof plugin.apply, 'function')
  assert.ok(plugin.inject.includes('remote.session'))

  const injected = []
  const registered = []
  const scope = { getSnapshot() {}, subscribe() {} }
  const ctx = {
    settingsScope: { bind: ({ namespace }) => {
      assert.equal(namespace, 'llm-pi-ai')
      return scope
    } },
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) } },
    slots: {
      inject(name, callback) {
        injected.push(name)
        callback()
        return () => {}
      },
      register(options, component) {
        registered.push({ options, component })
        return () => {}
      },
    },
  }

  plugin.apply(ctx)

  assert.deepEqual(injected.sort(), ['settings.models.provider-card', 'settings.plugins.tab'].sort())
  assert.equal(registered.length, 2)
  assert.equal(registered[0].options.name, 'settings.models.provider-card')
  assert.equal(registered[0].options.key, 'llm-pi-ai')
  assert.equal(registered[1].options.name, 'settings.plugins.tab')
  assert.equal(registered[1].options.label, '模型能力')
})

test('capability UI is collapsed-first and per-model only', async () => {
  const { code } = await loadBundle()
  const falseStates = code.match(/React\.useState\(false\)/g) ?? []
  assert.ok(falseStates.length >= 2, 'provider panel and model row must both start collapsed')
  assert.match(code, /按模型单独配置/)
  assert.match(code, /不会修改 Provider 默认能力/)
  assert.doesNotMatch(code, /保存默认值/)
  assert.match(code, /清除系列级多模态默认/)
})

test('settings mutate ops use string-only paths and preserve explicit model fields', async () => {
  const { plugin } = await loadBundle()
  const buildModelOps = plugin.__test?.buildModelOps
  assert.equal(typeof buildModelOps, 'function')

  const models = [
    {
      id: 'qwen3.8-27b',
      name: 'Qwen 3.8 27B',
      contextWindow: 128000,
      maxTokens: 32000,
      input: ['text'],
      compat: { preserveMe: true },
      reasoning: { enabled: true },
    },
    { id: 'other-model', name: 'Other', compat: { untouched: true } },
  ]

  const explicit = JSON.parse(JSON.stringify(buildModelOps(
    ['providers', 'aimax395'], models, 0, 'qwen3.8-27b', 'vision', 131072, 4096,
  )))
  assert.equal(explicit.length, 1)
  assert.deepEqual(explicit[0].path, ['providers', 'aimax395', 'models'])
  assert.ok(explicit[0].path.every(part => typeof part === 'string'))
  assert.deepEqual(explicit[0].value[0].input, ['text', 'image'])
  assert.equal(explicit[0].value[0].contextWindow, 131072)
  assert.equal(explicit[0].value[0].maxTokens, 4096)
  assert.deepEqual(explicit[0].value[0].compat, { preserveMe: true })
  assert.deepEqual(explicit[0].value[0].reasoning, { enabled: true })
  assert.deepEqual(explicit[0].value[1], models[1])

  const inherited = JSON.parse(JSON.stringify(buildModelOps(
    ['providers', 'aimax395'], models, 0, 'qwen3.8-27b', 'inherit', undefined, undefined,
  )))
  assert.equal('input' in inherited[0].value[0], false)
  assert.equal('contextWindow' in inherited[0].value[0], false)
  assert.equal('maxTokens' in inherited[0].value[0], false)
  assert.deepEqual(inherited[0].value[0].compat, { preserveMe: true })

  const catalog = JSON.parse(JSON.stringify(buildModelOps(
    ['providers', 'nvidia'], null, -1, 'vision-model', 'vision', undefined, undefined,
  )))
  assert.ok(catalog.every(op => op.path.every(part => typeof part === 'string')))
  assert.deepEqual(catalog[0].path, ['providers', 'nvidia', 'modelOverrides', 'vision-model', 'input'])
  assert.deepEqual(catalog[0].value, ['text', 'image'])
})
