import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadBundle() {
  const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let descriptor
  vm.runInNewContext(code, {
    console,
    structuredClone,
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

test('client bundle registers only the Plugins settings entry', async () => {
  const { code, plugin } = await loadBundle()
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

  assert.deepEqual(injected, ['settings.plugins.tab'])
  assert.equal(registered.length, 1)
  assert.equal(registered[0].options.name, 'settings.plugins.tab')
  assert.equal(registered[0].options.label, '模型能力')
  assert.doesNotMatch(code, /settings\.models\.provider-card/)
})

test('capability UI stays collapsed-first and separates user overrides from DSH resolved values', async () => {
  const { code } = await loadBundle()
  const falseStates = code.match(/React\.useState\(false\)/g) ?? []
  assert.ok(falseStates.length >= 2, 'provider panel and model row must both start collapsed')
  assert.match(code, /snapshot\.user/)
  assert.match(code, /留空 = 不写入配置/)
  assert.match(code, /DSH 当前解析值/)
  assert.match(code, /清除容量覆盖，恢复 DSH 自动识别/)
  assert.doesNotMatch(code, /保存默认值/)
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

  const catalog = JSON.parse(JSON.stringify(buildModelOps(
    ['providers', 'nvidia'], null, -1, 'vision-model', 'vision', undefined, undefined,
  )))
  assert.ok(catalog.every(op => op.path.every(part => typeof part === 'string')))
  assert.deepEqual(catalog[0].path, ['providers', 'nvidia', 'modelOverrides', 'vision-model', 'input'])
  assert.deepEqual(catalog[0].value, ['text', 'image'])
})

test('resolved capacity is display-only and is not materialized when saving only input capability', async () => {
  const { plugin } = await loadBundle()
  const { modelLayers, buildModelOps } = plugin.__test
  const effectiveProfile = {
    models: [{
      id: 'local-qwen',
      name: 'Local Qwen',
      contextWindow: 131072,
      maxTokens: 32768,
      input: ['text'],
      compat: { effectiveOnly: true },
    }],
  }
  const userProfile = {
    models: [{ id: 'local-qwen', name: 'Local Qwen', compat: { keep: true } }],
  }
  const layers = JSON.parse(JSON.stringify(modelLayers(effectiveProfile, userProfile, { id: 'local-qwen', name: 'Local Qwen' })))
  assert.equal(layers.resolvedContextWindow, 131072)
  assert.equal(layers.resolvedMaxTokens, 32768)
  assert.equal('contextWindow' in layers.userStored, false)
  assert.equal('maxTokens' in layers.userStored, false)

  const ops = JSON.parse(JSON.stringify(buildModelOps(
    ['providers', 'local'], userProfile.models, 0, 'local-qwen', 'vision', undefined, undefined,
  )))
  assert.deepEqual(ops[0].value[0].input, ['text', 'image'])
  assert.equal('contextWindow' in ops[0].value[0], false)
  assert.equal('maxTokens' in ops[0].value[0], false)
  assert.deepEqual(ops[0].value[0].compat, { keep: true })
})

test('capacity cleanup removes only explicit capacity fields', async () => {
  const { plugin } = await loadBundle()
  const reset = plugin.__test?.buildCapacityResetOps
  assert.equal(typeof reset, 'function')

  const models = [{
    id: 'local-qwen',
    input: ['text', 'image'],
    contextWindow: 128000,
    maxTokens: 32000,
    compat: { keep: true },
  }]
  const ops = JSON.parse(JSON.stringify(reset(['providers', 'local'], models, 0, 'local-qwen')))
  assert.equal('contextWindow' in ops[0].value[0], false)
  assert.equal('maxTokens' in ops[0].value[0], false)
  assert.deepEqual(ops[0].value[0].input, ['text', 'image'])
  assert.deepEqual(ops[0].value[0].compat, { keep: true })
})
