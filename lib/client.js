window.__ModuleLoader__.load({ id: 'dsh-model-mgr', factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
const React = require('react')

const NS = 'llm-pi-ai'
const SLOT = 'settings.models.provider-card'
const PROBE_PATH = '/plugins/dsh-model-mgr/probe'

function at(root, path) {
  let value = root
  for (const key of path || []) {
    if (value == null || typeof value !== 'object') return undefined
    value = value[key]
  }
  return value
}
function inputMode(value) {
  if (!Array.isArray(value) || value.length === 0) return 'inherit'
  return value.includes('image') && value.includes('text') ? 'vision' : 'text'
}
function inputValue(mode) {
  return mode === 'vision' ? ['text', 'image'] : ['text']
}
function useScope(scope) {
  return React.useSyncExternalStore(
    React.useCallback(listener => scope.subscribe(listener), [scope]),
    React.useCallback(() => scope.getSnapshot(), [scope]),
  )
}
function field(label, control, hint) {
  return React.createElement('label', { style: { display: 'grid', gap: 5, marginBottom: 12 } },
    React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, label),
    control,
    hint ? React.createElement('span', { style: { fontSize: 12, opacity: .68 } }, hint) : null,
  )
}
const selectStyle = { width: '100%', minHeight: 34, border: '1px solid var(--dsw-border, #d9d9d9)', borderRadius: 7, background: 'var(--dsw-bg, transparent)', padding: '0 8px' }
const inputStyle = { ...selectStyle, boxSizing: 'border-box' }
const buttonStyle = { minHeight: 32, border: '1px solid var(--dsw-border, #d9d9d9)', borderRadius: 7, background: 'var(--dsw-bg, transparent)', padding: '0 11px', cursor: 'pointer' }

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
  if (result.ok) return `✅ ${kind === 'vision' ? '视觉通路正常' : '文本调用正常'}${result.latencyMs != null ? ` · ${result.latencyMs}ms` : ''}`
  if (result.layer === 'dsh') return `❌ DSH 层：${result.message || '当前未声明图片输入'}`
  if (result.layer === 'provider') return `❌ Provider 层：${result.message || result.error?.message || '请求失败'}`
  if (result.layer === 'model') return `⚠ 通路成功 / 识别异常${result.text ? `：${result.text}` : ''}`
  return `❌ ${result.error?.message || result.message || '测试失败'}`
}

function ModelRow({ scope, provider, providerPath, model, profile, revision }) {
  const explicit = Array.isArray(profile?.models)
  const explicitIndex = explicit ? profile.models.findIndex(item => item?.id === model.id) : -1
  const stored = explicitIndex >= 0 ? profile.models[explicitIndex] : profile?.modelOverrides?.[model.id]
  const basePath = explicitIndex >= 0
    ? [...providerPath, 'models', explicitIndex]
    : [...providerPath, 'modelOverrides', model.id]
  const [mode, setMode] = React.useState(inputMode(stored?.input))
  const [contextWindow, setContextWindow] = React.useState(stored?.contextWindow == null ? '' : String(stored.contextWindow))
  const [maxTokens, setMaxTokens] = React.useState(stored?.maxTokens == null ? '' : String(stored.maxTokens))
  const [message, setMessage] = React.useState('')
  const [textResult, setTextResult] = React.useState(null)
  const [visionResult, setVisionResult] = React.useState(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setMode(inputMode(stored?.input))
    setContextWindow(stored?.contextWindow == null ? '' : String(stored.contextWindow))
    setMaxTokens(stored?.maxTokens == null ? '' : String(stored.maxTokens))
  }, [revision, model.id])

  async function save() {
    try {
      const ops = []
      if (mode === 'inherit') ops.push({ op: 'unset', path: [...basePath, 'input'] })
      else ops.push({ op: 'set', path: [...basePath, 'input'], value: inputValue(mode) })
      const cw = contextWindow.trim()
      const mt = maxTokens.trim()
      if (cw === '') ops.push({ op: 'unset', path: [...basePath, 'contextWindow'] })
      else {
        const value = Number(cw)
        if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Context Window 必须是正整数')
        ops.push({ op: 'set', path: [...basePath, 'contextWindow'], value })
      }
      if (mt === '') ops.push({ op: 'unset', path: [...basePath, 'maxTokens'] })
      else {
        const value = Number(mt)
        if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Max Tokens 必须是正整数')
        ops.push({ op: 'set', path: [...basePath, 'maxTokens'], value })
      }
      setBusy(true); setMessage('保存中…')
      await scope.mutate(ops, revision)
      const next = scope.getSnapshot()
      if (next.revision === revision) setMessage('⚠ 保存未生效，配置可能已被其他页面修改；已刷新，请重新确认。')
      else setMessage('✅ 已保存到 DSH 原生 llm-pi-ai settings')
    } catch (error) {
      setMessage(`❌ ${error?.message || error}`)
    } finally { setBusy(false) }
  }
  async function run(kind) {
    setBusy(true)
    try {
      const result = await probe(provider, model.id, kind)
      if (kind === 'text') setTextResult(result); else setVisionResult(result)
    } catch (error) {
      const result = { ok: false, layer: 'provider', error: { message: error?.message || String(error) } }
      if (kind === 'text') setTextResult(result); else setVisionResult(result)
    } finally { setBusy(false) }
  }

  return React.createElement('div', { style: { padding: '14px 0', borderTop: '1px solid var(--dsw-border, rgba(127,127,127,.22))' } },
    React.createElement('div', { style: { fontWeight: 700, marginBottom: 4, wordBreak: 'break-all' } }, model.name || model.id),
    model.name && model.name !== model.id ? React.createElement('div', { style: { fontSize: 12, opacity: .65, marginBottom: 10 } }, model.id) : null,
    field('输入能力', React.createElement('select', { style: selectStyle, value: mode, onChange: e => setMode(e.target.value), disabled: busy },
      React.createElement('option', { value: 'inherit' }, '继承默认值'),
      React.createElement('option', { value: 'text' }, '纯文本'),
      React.createElement('option', { value: 'vision' }, '多模态（文本 + 图片）'),
    ), '“继承”会 unset 模型自己的 input，而不是写空数组。'),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } },
      field('Context Window', React.createElement('input', { style: inputStyle, inputMode: 'numeric', value: contextWindow, placeholder: '留空 = 继承', onChange: e => setContextWindow(e.target.value), disabled: busy })),
      field('Max Tokens', React.createElement('input', { style: inputStyle, inputMode: 'numeric', value: maxTokens, placeholder: '留空 = 继承', onChange: e => setMaxTokens(e.target.value), disabled: busy })),
    ),
    React.createElement('div', { style: { display: 'grid', gap: 5, fontSize: 12, marginBottom: 10 } },
      React.createElement('span', null, statusText(textResult, 'text')),
      React.createElement('span', null, statusText(visionResult, 'vision')),
    ),
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
      React.createElement('button', { style: buttonStyle, disabled: busy, onClick: () => run('text') }, '测试文本'),
      React.createElement('button', { style: buttonStyle, disabled: busy, onClick: () => run('vision') }, '测试视觉'),
      React.createElement('button', { style: buttonStyle, disabled: busy, onClick: save }, '保存'),
      React.createElement('button', { style: buttonStyle, disabled: busy, onClick: () => { setMode('inherit'); setContextWindow(''); setMaxTokens('') } }, '恢复继承'),
    ),
    message ? React.createElement('div', { style: { fontSize: 12, marginTop: 8 } }, message) : null,
  )
}

function CapabilityPanel({ scope, catalog, owner }) {
  const snapshot = useScope(scope)
  const entry = owner.provider
  if (!entry || entry.settingsNs !== NS) return null
  if (snapshot.status !== 'ready') return React.createElement('div', { style: { marginTop: 12, fontSize: 12, opacity: .7 } }, 'dsh-model-mgr：正在读取模型配置…')
  const path = Array.isArray(entry.settingsPath) ? [...entry.settingsPath] : []
  if (!path.length) return null
  const profile = at(snapshot.value, path)
  if (!profile || typeof profile !== 'object') return null
  const group = catalog.groups.find(group => group.id === entry.provider)
  const models = group?.models || (Array.isArray(profile.models) ? profile.models.map(m => ({ id: m.id, name: m.name || m.id })) : [])
  const [defaultMode, setDefaultMode] = React.useState(inputMode(profile.defaultInput) === 'vision' ? 'vision' : 'text')
  const [providerMessage, setProviderMessage] = React.useState('')
  React.useEffect(() => setDefaultMode(inputMode(profile.defaultInput) === 'vision' ? 'vision' : 'text'), [snapshot.revision, entry.provider])

  async function saveDefault() {
    const value = inputValue(defaultMode)
    setProviderMessage('保存中…')
    try {
      const before = snapshot.revision
      await scope.mutate([{ op: 'set', path: [...path, 'defaultInput'], value }], before)
      setProviderMessage(scope.getSnapshot().revision === before ? '⚠ 保存未生效，revision 可能冲突；已刷新。' : '✅ Provider 默认能力已保存')
    } catch (error) { setProviderMessage(`❌ ${error?.message || error}`) }
  }

  return React.createElement('section', { style: { marginTop: 14, padding: 14, border: '1px solid var(--dsw-border, rgba(127,127,127,.24))', borderRadius: 10 } },
    React.createElement('div', { style: { fontWeight: 800, marginBottom: 4 } }, '模型能力 · dsh-model-mgr'),
    React.createElement('div', { style: { fontSize: 12, opacity: .7, marginBottom: 12 } }, '声明能力与实际测试结果分开显示；插件不会根据模型名称自动猜测视觉能力。'),
    field('未声明模型的默认输入能力', React.createElement('div', { style: { display: 'flex', gap: 8 } },
      React.createElement('select', { style: { ...selectStyle, flex: 1 }, value: defaultMode, onChange: e => setDefaultMode(e.target.value) },
        React.createElement('option', { value: 'text' }, '纯文本'),
        React.createElement('option', { value: 'vision' }, '多模态（文本 + 图片）'),
      ),
      React.createElement('button', { style: buttonStyle, onClick: saveDefault }, '保存默认值'),
    ), '`defaultInput` 只是 fallback，不强制覆盖模型自己的 input。'),
    providerMessage ? React.createElement('div', { style: { fontSize: 12, marginBottom: 8 } }, providerMessage) : null,
    models.length === 0
      ? React.createElement('div', { style: { fontSize: 12, opacity: .72, padding: '10px 0' } }, '当前 Provider 没有可枚举模型。手工添加模型后会在这里出现。')
      : models.map(model => React.createElement(ModelRow, { key: model.id, scope, provider: entry.provider, providerPath: path, model, profile, revision: snapshot.revision })),
  )
}

const inject = ['slots', 'settingsScope', 'remote']
function apply(ctx) {
  const scope = ctx.settingsScope.bind({ namespace: NS })
  let catalog = { groups: [] }
  let catalogPromise
  const loadCatalog = () => {
    if (catalogPromise) return catalogPromise
    catalogPromise = ctx.remote.session.modelCatalog().then(response => {
      if (response?.ok && response.value) catalog = response.value
      return catalog
    }).catch(() => catalog)
    return catalogPromise
  }
  const ProviderExtension = owner => {
    const [, rerender] = React.useReducer(x => x + 1, 0)
    React.useEffect(() => { loadCatalog().then(() => rerender()) }, [])
    return React.createElement(CapabilityPanel, { scope, catalog, owner })
  }
  ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, key: NS }, ProviderExtension))
}

module.exports = { inject, apply }
return module.exports; } });
