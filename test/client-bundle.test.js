import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('client bundle loads and registers primary plus compatibility settings entries', async () => {
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

test('provider capability panel and model rows are both collapsed by default', async () => {
  const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(code, /const \[panelOpen, setPanelOpen\] = React\.useState\(false\)/)
  assert.match(code, /const \[open, setOpen\] = React\.useState\(false\)/)
  assert.doesNotMatch(code, /const bodyVisible = !standalone \|\| standaloneOpen/)
  assert.match(code, /panelOpen \? h\('div', \{ key: 'body'/)
})
