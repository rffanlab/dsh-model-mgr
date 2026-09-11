(() => {
  const ID = 'dsh-model-mgr'
  window.__ModuleLoader__.load({
    id: ID,
    factory(require) {
      const React = require('react')
      const h = React.createElement
      const NS = 'llm-pi-ai'
      const MODEL_SLOT = 'settings.models.provider-card'
      const FALLBACK_SLOT = 'settings.plugins.tab'
      const PROBE_PATH = '/plugins/dsh-model-mgr/probe'

      const control = {
        width: '100%', minHeight: 34,
        border: '1px solid color-mix(in srgb,currentColor 18%,transparent)',
        borderRadius: 7, background: 'transparent', color: 'inherit',
        padding: '0 8px', boxSizing: 'border-box',
      }
      const button = {
        minHeight: 32,
        border: '1px solid color-mix(in srgb,currentColor 18%,transparent)',
        borderRadius: 7, background: 'transparent', color: 'inherit',
        padding: '0 11px', cursor: 'pointer',
      }
      const iconButton = {
        width: 32, height: 32, padding: 0,
        border: '1px solid color-mix(in srgb,currentColor 16%,transparent)',
        borderRadius: 7, background: 'transparent', color: 'inherit', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
      }

      function at(root, path) {
        let value = root
        for (const key of path || []) {
          if (value == null || typeof value !== 'object') return undefined
          value = value[key]
        }
        return value
      }

      function modeOf(value) {
        if (!Array.isArray(value) || !value.includes('text')) return 'inherit'
        return value.includes('image') ? 'vision' : 'text'
      }

      function inputOf(mode) {
        return mode === 'vision' ? ['text', 'image'] : ['text']
      }

      function modeLabel(mode) {
        if (mode === 'vision') return '文本 + 图片'
        if (mode === 'text') return '纯文本'
        return '继承 DSH 默认/目录'
      }

      function useScope(scope) {
        const subscribe = React.useCallback(fn => scope.subscribe(fn), [scope])
        const read = React.useCallback(() => scope.getSnapshot(), [scope])
        return React.useSyncExternalStore(subscribe, read, read)
      }

      function Labelled({ label, hint, children }) {
        return h('label', { style: { display: 'grid', gap: 5, marginBottom: 12 } }, [
          h('span', { key: 'label', style: { fontSize: 13, fontWeight: 600 } }, label),
          h(React.Fragment, { key: 'control' }, children),
          hint ? h('span', { key: 'hint', style: { fontSize: 12, opacity: .68 } }, hint) : null,
        ])
      }

      function Chevron({ open }) {
        return h('svg', {
          width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
          style: { transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms ease' },
        }, h('path', {
          d: 'M6 3.5L10.5 8L6 12.5', stroke: 'currentColor', strokeWidth: 1.5,
          strokeLinecap: 'round', strokeLinejoin: 'round',
        }))
      }

      function explicitModels(profile) {
        if (!Array.isArray(profile?.models)) return []
        return profile.models
          .filter(model => model && typeof model.id === 'string' && model.id.length > 0)
          .map(model => ({ id: model.id, name: model.name || model.id }))
      }

      function setOrDelete(object, key, value) {
        if (value === undefined) delete object[key]
        else object[key] = value
      }

      function buildModelOps(providerPath, list, index, modelId, mode, contextWindow, maxTokens) {
        if (!Array.isArray(providerPath) || providerPath.some(part => typeof part !== 'string')) {
          throw new Error('Provider settingsPath must contain only strings')
        }
        if (index >= 0) {
          if (!Array.isArray(list) || !list[index]) throw new Error('Explicit model row is no longer available')
          const models = structuredClone(list)
          const row = { ...models[index] }
          setOrDelete(row, 'input', mode === 'inherit' ? undefined : inputOf(mode))
          setOrDelete(row, 'contextWindow', contextWindow)
          setOrDelete(row, 'maxTokens', maxTokens)
          models[index] = row
          return [{ op: 'set', path: [...providerPath, 'models'], value: models }]
        }

        if (typeof modelId !== 'string' || modelId.length === 0) throw new Error('Model id is required')
        const base = [...providerPath, 'modelOverrides', modelId]
        return [
          mode === 'inherit'
            ? { op: 'unset', path: [...base, 'input'] }
            : { op: 'set', path: [...base, 'input'], value: inputOf(mode) },
          contextWindow === undefined
            ? { op: 'unset', path: [...base, 'contextWindow'] }
            : { op: 'set', path: [...base, 'contextWindow'], value: contextWindow },
          maxTokens === undefined
            ? { op: 'unset', path: [...base, 'maxTokens'] }
            : { op: 'set', path: [...base, 'maxTokens'], value: maxTokens },
        ]
      }

      async function probe(provider, model, kind) {
        const response = await fetch(PROBE_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider, model, kind }),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      }

      function statusText(result, kind) {
        if (!result) return kind === 'vision' ? '⚠ 未测试' : '⚪ 未测试'
        if (result.ok) {
          return `✅ ${kind === 'vision' ? '视觉通路正常' : '文本调用正常'}${result.latencyMs != null ? ` · ${result.latencyMs}ms` : ''}`
        }
        if (result.layer === 'dsh') return `❌ DSH 层：${result.message || result.error?.message || '当前未声明图片输入'}`
        if (result.layer === 'provider') return `❌ Provider 层：${result.message || result.error?.message || '请求失败'}`
        if (result.layer === 'model') return `⚠ 通路成功 / 识别异常${result.text ? `：${result.text}` : ''}`
        return `❌ ${result.error?.message || result.message || '测试失败'}`
      }

      function ModelRow({ scope, provider, providerPath, model, profile, revision, writable }) {
        const list = Array.isArray(profile?.models) ? profile.models : null
        const index = list ? list.findIndex(item => item?.id === model.id) : -1
        const stored = index >= 0 ? list[index] : profile?.modelOverrides?.[model.id]

        const [open, setOpen] = React.useState(false)
        const [mode, setMode] = React.useState(() => modeOf(stored?.input))
        const [cw, setCw] = React.useState(() => stored?.contextWindow == null ? '' : String(stored.contextWindow))
        const [mt, setMt] = React.useState(() => stored?.maxTokens == null ? '' : String(stored.maxTokens))
        const [message, setMessage] = React.useState('')
        const [textResult, setTextResult] = React.useState(null)
        const [visionResult, setVisionResult] = React.useState(null)
        const [busy, setBusy] = React.useState(false)

        React.useEffect(() => {
          setMode(modeOf(stored?.input))
          setCw(stored?.contextWindow == null ? '' : String(stored.contextWindow))
          setMt(stored?.maxTokens == null ? '' : String(stored.maxTokens))
          setOpen(false)
        }, [revision, model.id])

        const disabled = busy || !writable

        function integer(raw, label) {
          if (raw.trim() === '') return undefined
          const value = Number(raw)
          if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} 必须是正整数`)
          return value
        }

        async function save() {
          if (!writable) return
          setBusy(true)
          setMessage('保存中…')
          try {
            const contextWindow = integer(cw, 'Context Window')
            const maxTokens = integer(mt, 'Max Tokens')
            const ops = buildModelOps(providerPath, list, index, model.id, mode, contextWindow, maxTokens)
            const before = revision
            await scope.mutate(ops, before)
            const after = scope.getSnapshot().revision
            setMessage(after === before
              ? '⚠ 保存未生效，可能发生 revision 冲突；配置已刷新。'
              : '✅ 已保存到 DSH 原生模型设置')
          } catch (error) {
            setMessage(`❌ ${error?.message || error}`)
          } finally {
            setBusy(false)
          }
        }

        async function run(kind) {
          setBusy(true)
          try {
            const result = await probe(provider, model.id, kind)
            if (kind === 'text') setTextResult(result)
            else setVisionResult(result)
          } catch (error) {
            const result = { ok: false, layer: 'provider', error: { message: error?.message || String(error) } }
            if (kind === 'text') setTextResult(result)
            else setVisionResult(result)
          } finally {
            setBusy(false)
          }
        }

        const summary = [
          modeLabel(modeOf(stored?.input)),
          stored?.contextWindow ? `Context ${stored.contextWindow}` : null,
          stored?.maxTokens ? `Max ${stored.maxTokens}` : null,
        ].filter(Boolean).join(' · ')

        return h('div', { style: { borderTop: '1px solid color-mix(in srgb,currentColor 14%,transparent)' } }, [
          h('div', { key: 'row', style: { minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' } }, [
            h('div', { key: 'identity', style: { minWidth: 0, flex: 1 } }, [
              h('div', { key: 'name', style: { fontWeight: 650, wordBreak: 'break-all' } }, model.name || model.id),
              h('div', { key: 'summary', style: { marginTop: 3, fontSize: 12, opacity: .62, wordBreak: 'break-all' } },
                `${model.name && model.name !== model.id ? `${model.id} · ` : ''}${summary}`),
            ]),
            h('button', {
              key: 'toggle', type: 'button', style: iconButton,
              'aria-expanded': open, title: open ? '收起模型能力' : '展开模型能力',
              onClick: () => setOpen(value => !value),
            }, h(Chevron, { open })),
          ]),
          open ? h('div', { key: 'body', style: { padding: '6px 0 14px' } }, [
            h(Labelled, {
              key: 'mode', label: '输入能力',
              hint: '只修改这个模型。继承会清除模型自己的 input；不会修改 Provider 默认能力。',
            }, h('select', {
              style: control, value: mode, disabled,
              onChange: event => setMode(event.currentTarget.value),
            }, [
              h('option', { key: 'inherit', value: 'inherit' }, '继承 DSH 默认/目录'),
              h('option', { key: 'text', value: 'text' }, '纯文本'),
              h('option', { key: 'vision', value: 'vision' }, '多模态（文本 + 图片）'),
            ])),
            h('div', { key: 'limits', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } }, [
              h(Labelled, { key: 'cw', label: 'Context Window' },
                h('input', { style: control, value: cw, disabled, placeholder: '留空 = 继承', inputMode: 'numeric', onChange: event => setCw(event.currentTarget.value) })),
              h(Labelled, { key: 'mt', label: 'Max Tokens' },
                h('input', { style: control, value: mt, disabled, placeholder: '留空 = 继承', inputMode: 'numeric', onChange: event => setMt(event.currentTarget.value) })),
            ]),
            h('div', { key: 'status', style: { display: 'grid', gap: 5, fontSize: 12, marginBottom: 10 } }, [
              h('span', { key: 'text' }, statusText(textResult, 'text')),
              h('span', { key: 'vision' }, statusText(visionResult, 'vision')),
            ]),
            h('div', { key: 'actions', style: { display: 'flex', flexWrap: 'wrap', gap: 8 } }, [
              h('button', { key: 'text', style: button, disabled: busy, onClick: () => run('text') }, '测试文本'),
              h('button', { key: 'vision', style: button, disabled: busy, onClick: () => run('vision') }, '测试视觉'),
              h('button', { key: 'save', style: button, disabled, onClick: save }, '保存'),
              h('button', {
                key: 'reset', style: button, disabled,
                onClick: () => { setMode('inherit'); setCw(''); setMt('') },
              }, '恢复继承'),
            ]),
            message ? h('div', { key: 'message', style: { fontSize: 12, marginTop: 8 } }, message) : null,
          ]) : null,
        ])
      }

      function ProviderPanel({ scope, catalog, entry, standalone = false }) {
        const snapshot = useScope(scope)
        const path = Array.isArray(entry?.settingsPath) ? [...entry.settingsPath] : []
        const profile = snapshot.status === 'ready' && path.length ? at(snapshot.value, path) : undefined
        const [open, setOpen] = React.useState(false)
        const [message, setMessage] = React.useState('')

        React.useEffect(() => { setOpen(false) }, [entry?.provider])

        if (!entry || entry.settingsNs !== NS) return null
        if (snapshot.status !== 'ready') {
          return h('div', { style: { marginTop: 12, fontSize: 12, opacity: .72 } }, 'dsh-model-mgr：正在读取模型配置…')
        }
        if (!path.length || !profile || typeof profile !== 'object') return null

        const group = (catalog?.groups || []).find(candidate => candidate.id === entry.provider)
        const catalogModels = Array.isArray(group?.models) ? group.models : []
        const localModels = explicitModels(profile)
        const models = catalogModels.length > 0 ? catalogModels : localModels
        const writable = snapshot.writable !== false
        const legacyProviderVision = modeOf(profile.defaultInput) === 'vision'

        async function clearLegacyDefault() {
          if (!writable) return
          setMessage('清理中…')
          try {
            const before = snapshot.revision
            await scope.mutate([{ op: 'unset', path: [...path, 'defaultInput'] }], before)
            setMessage(scope.getSnapshot().revision === before
              ? '⚠ 清理未生效，可能发生 revision 冲突。'
              : '✅ 已清除系列级多模态默认；未单独声明的模型恢复 DSH 默认文本/目录能力。')
          } catch (error) {
            setMessage(`❌ ${error?.message || error}`)
          }
        }

        return h('section', {
          style: {
            marginTop: standalone ? 0 : 14,
            marginBottom: standalone ? 10 : 0,
            padding: 14,
            border: '1px solid color-mix(in srgb,currentColor 16%,transparent)',
            borderRadius: 10,
          },
        }, [
          h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
            h('div', { key: 'title', style: { minWidth: 0, flex: 1 } }, [
              h('div', { key: 'name', style: { fontWeight: 800 } },
                standalone ? `${entry.displayName || entry.provider} · 模型能力` : '模型能力 · dsh-model-mgr'),
              h('div', { key: 'meta', style: { fontSize: 12, opacity: .62, marginTop: 3 } },
                `${models.length} 个模型 · 默认收起 · 按模型单独配置`),
            ]),
            h('button', {
              key: 'toggle', type: 'button', style: iconButton,
              'aria-expanded': open, title: open ? '收起模型能力' : '展开模型能力',
              onClick: () => setOpen(value => !value),
            }, h(Chevron, { open })),
          ]),
          open ? h('div', { key: 'body', style: { marginTop: 10 } }, [
            legacyProviderVision ? h('div', {
              key: 'legacy',
              style: { padding: 10, marginBottom: 10, borderRadius: 8, background: 'color-mix(in srgb,#e7b35a 12%,transparent)', fontSize: 12 },
            }, [
              h('div', { key: 'text', style: { marginBottom: 8 } },
                '检测到这个 Provider 的 defaultInput 仍是“文本 + 图片”。这是旧版留下的系列级 fallback；当前版本只按模型配置。'),
              h('button', { key: 'clear', style: button, disabled: !writable, onClick: clearLegacyDefault }, '清除系列级多模态默认'),
            ]) : null,
            h('div', { key: 'intro', style: { fontSize: 12, opacity: .7, marginBottom: 8 } },
              '下面只对单个模型写 input / Context Window / Max Tokens；不会修改整个 Provider 的默认输入能力。'),
            message ? h('div', { key: 'message', style: { fontSize: 12, marginBottom: 8 } }, message) : null,
            models.length > 0
              ? models.map(model => h(ModelRow, {
                  key: model.id,
                  scope,
                  provider: entry.provider,
                  providerPath: path,
                  model,
                  profile,
                  revision: snapshot.revision,
                  writable,
                }))
              : h('div', { key: 'empty', style: { fontSize: 12, opacity: .72, padding: '10px 0' } }, '当前 Provider 没有可枚举模型。'),
          ]) : null,
        ])
      }

      function ProviderExtension({ scope, loadCatalog, provider }) {
        const [catalog, setCatalog] = React.useState({ groups: [] })
        React.useEffect(() => {
          let active = true
          loadCatalog().then(value => { if (active) setCatalog(value) })
          return () => { active = false }
        }, [loadCatalog])
        return h(ProviderPanel, { scope, catalog, entry: provider })
      }

      function FallbackManager({ scope, loadCatalog }) {
        const snapshot = useScope(scope)
        const [catalog, setCatalog] = React.useState({ groups: [] })
        React.useEffect(() => {
          let active = true
          loadCatalog().then(value => { if (active) setCatalog(value) })
          return () => { active = false }
        }, [loadCatalog])

        if (snapshot.status !== 'ready') {
          return h('div', { style: { padding: 18, opacity: .72 } }, '正在读取 llm-pi-ai 模型配置…')
        }
        const providers = snapshot.value?.providers && typeof snapshot.value.providers === 'object'
          ? snapshot.value.providers
          : {}
        const entries = Object.entries(providers).map(([provider, profile]) => ({
          provider,
          displayName: profile?.displayName || provider,
          settingsNs: NS,
          settingsPath: ['providers', provider],
          active: true,
        }))

        return h('div', { style: { display: 'grid', gap: 10, padding: 2 } }, [
          h('div', { key: 'head', style: { marginBottom: 2 } }, [
            h('h3', { key: 'title', style: { margin: '0 0 6px' } }, '模型能力'),
            h('div', { key: 'hint', style: { fontSize: 12, opacity: .7 } },
              '每个 Provider 和每个模型都默认收起；能力只按模型单独保存。'),
          ]),
          entries.length > 0
            ? entries.map(entry => h(ProviderPanel, { key: entry.provider, scope, catalog, entry, standalone: true }))
            : h('div', { key: 'empty', style: { padding: 20, opacity: .7 } }, '当前没有已配置的 llm-pi-ai Provider。'),
        ])
      }

      const inject = ['slots', 'settingsScope', 'remote', 'remote.session']

      function apply(ctx) {
        const scope = ctx.settingsScope.bind({ namespace: NS })
        let cachedCatalog = { groups: [] }
        let catalogPromise = null

        const loadCatalog = () => {
          if (catalogPromise) return catalogPromise
          catalogPromise = Promise.resolve().then(async () => {
            const session = ctx.remote?.session
            if (!session || typeof session.modelCatalog !== 'function') return cachedCatalog
            const response = await session.modelCatalog()
            if (response?.ok && response.value) cachedCatalog = response.value
            return cachedCatalog
          }).catch(error => {
            console.warn('[dsh-model-mgr] model catalog unavailable; falling back to explicit settings models:', error)
            return cachedCatalog
          }).finally(() => { catalogPromise = null })
          return catalogPromise
        }

        ctx.slots.inject(MODEL_SLOT, () => ctx.slots.register({
          name: MODEL_SLOT,
          key: NS,
          inject: () => ({ scope, loadCatalog }),
        }, ProviderExtension))

        ctx.slots.inject(FALLBACK_SLOT, () => ctx.slots.register({
          name: FALLBACK_SLOT,
          id: 'model-capabilities',
          order: 30,
          label: '模型能力',
          inject: () => ({ scope, loadCatalog }),
        }, FallbackManager))
      }

      return { inject, apply, __test: { buildModelOps } }
    },
  })
})()
