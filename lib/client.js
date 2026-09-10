window.__ModuleLoader__.load({ id: 'dsh-model-mgr', factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
const React = require('react')
const NS = 'llm-pi-ai'
const SLOT = 'settings.models.provider-card'
const PROBE_PATH = '/plugins/dsh-model-mgr/probe'
const control = { width: '100%', minHeight: 34, border: '1px solid rgba(127,127,127,.3)', borderRadius: 7, background: 'transparent', padding: '0 8px', boxSizing: 'border-box' }
const button = { minHeight: 32, border: '1px solid rgba(127,127,127,.3)', borderRadius: 7, background: 'transparent', padding: '0 11px', cursor: 'pointer' }

function at(root, path) { let v = root; for (const k of path || []) { if (v == null || typeof v !== 'object') return undefined; v = v[k] } return v }
function modeOf(v) { return Array.isArray(v) && v.includes('text') ? (v.includes('image') ? 'vision' : 'text') : 'inherit' }
function inputOf(mode) { return mode === 'vision' ? ['text', 'image'] : ['text'] }
function useScope(scope) { return React.useSyncExternalStore(React.useCallback(fn => scope.subscribe(fn), [scope]), React.useCallback(() => scope.getSnapshot(), [scope])) }
function labelled(label, node, hint) { return React.createElement('label', { style: { display: 'grid', gap: 5, marginBottom: 12 } }, React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, label), node, hint ? React.createElement('span', { style: { fontSize: 12, opacity: .68 } }, hint) : null) }
async function probe(provider, model, kind) { const r = await fetch(PROBE_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, model, kind }) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }
function status(result, kind) { if (!result) return kind === 'vision' ? '⚠ 未测试' : '⚪ 未测试'; if (result.ok) return `✅ ${kind === 'vision' ? '视觉通路正常' : '文本调用正常'}${result.latencyMs != null ? ` · ${result.latencyMs}ms` : ''}`; if (result.layer === 'dsh') return `❌ DSH 层：${result.message || '未声明图片输入'}`; if (result.layer === 'provider') return `❌ Provider 层：${result.message || result.error?.message || '请求失败'}`; if (result.layer === 'model') return `⚠ 通路成功 / 识别异常${result.text ? `：${result.text}` : ''}`; return `❌ ${result.error?.message || result.message || '测试失败'}` }

function ModelRow({ scope, provider, providerPath, model, profile, revision }) {
  const list = Array.isArray(profile?.models) ? profile.models : null
  const index = list ? list.findIndex(item => item?.id === model.id) : -1
  const stored = index >= 0 ? list[index] : profile?.modelOverrides?.[model.id]
  const basePath = index >= 0 ? [...providerPath, 'models', index] : [...providerPath, 'modelOverrides', model.id]
  const [mode, setMode] = React.useState(modeOf(stored?.input))
  const [cw, setCw] = React.useState(stored?.contextWindow == null ? '' : String(stored.contextWindow))
  const [mt, setMt] = React.useState(stored?.maxTokens == null ? '' : String(stored.maxTokens))
  const [msg, setMsg] = React.useState('')
  const [textResult, setTextResult] = React.useState(null)
  const [visionResult, setVisionResult] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { setMode(modeOf(stored?.input)); setCw(stored?.contextWindow == null ? '' : String(stored.contextWindow)); setMt(stored?.maxTokens == null ? '' : String(stored.maxTokens)) }, [revision, model.id])

  async function save() {
    try {
      const integer = (raw, name) => { if (raw.trim() === '') return undefined; const n = Number(raw); if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name} 必须是正整数`); return n }
      const ops = [mode === 'inherit' ? { op: 'unset', path: [...basePath, 'input'] } : { op: 'set', path: [...basePath, 'input'], value: inputOf(mode) }]
      for (const [name, field, raw] of [['Context Window', 'contextWindow', cw], ['Max Tokens', 'maxTokens', mt]]) { const n = integer(raw, name); ops.push(n === undefined ? { op: 'unset', path: [...basePath, field] } : { op: 'set', path: [...basePath, field], value: n }) }
      setBusy(true); setMsg('保存中…'); const before = revision; await scope.mutate(ops, before); setMsg(scope.getSnapshot().revision === before ? '⚠ 保存未生效，可能发生 revision 冲突；配置已刷新，请重新确认。' : '✅ 已保存到 DSH 原生 llm-pi-ai settings')
    } catch (e) { setMsg(`❌ ${e?.message || e}`) } finally { setBusy(false) }
  }
  async function run(kind) { setBusy(true); try { const r = await probe(provider, model.id, kind); kind === 'text' ? setTextResult(r) : setVisionResult(r) } catch (e) { const r = { ok: false, layer: 'provider', error: { message: e?.message || String(e) } }; kind === 'text' ? setTextResult(r) : setVisionResult(r) } finally { setBusy(false) } }

  return React.createElement('div', { style: { padding: '14px 0', borderTop: '1px solid rgba(127,127,127,.22)' } },
    React.createElement('div', { style: { fontWeight: 700, marginBottom: 4, wordBreak: 'break-all' } }, model.name || model.id),
    model.name && model.name !== model.id ? React.createElement('div', { style: { fontSize: 12, opacity: .65, marginBottom: 10 } }, model.id) : null,
    labelled('输入能力', React.createElement('select', { style: control, value: mode, onChange: e => setMode(e.target.value), disabled: busy }, React.createElement('option', { value: 'inherit' }, '继承默认值'), React.createElement('option', { value: 'text' }, '纯文本'), React.createElement('option', { value: 'vision' }, '多模态（文本 + 图片）')), '继承会 unset 模型自己的 input，不写空数组。'),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 } }, labelled('Context Window', React.createElement('input', { style: control, value: cw, placeholder: '留空 = 继承', onChange: e => setCw(e.target.value), disabled: busy })), labelled('Max Tokens', React.createElement('input', { style: control, value: mt, placeholder: '留空 = 继承', onChange: e => setMt(e.target.value), disabled: busy }))),
    React.createElement('div', { style: { display: 'grid', gap: 5, fontSize: 12, marginBottom: 10 } }, React.createElement('span', null, status(textResult, 'text')), React.createElement('span', null, status(visionResult, 'vision'))),
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } }, React.createElement('button', { style: button, disabled: busy, onClick: () => run('text') }, '测试文本'), React.createElement('button', { style: button, disabled: busy, onClick: () => run('vision') }, '测试视觉'), React.createElement('button', { style: button, disabled: busy, onClick: save }, '保存'), React.createElement('button', { style: button, disabled: busy, onClick: () => { setMode('inherit'); setCw(''); setMt('') } }, '恢复继承')),
    msg ? React.createElement('div', { style: { fontSize: 12, marginTop: 8 } }, msg) : null)
}

function CapabilityPanel({ scope, catalog, owner }) {
  const snapshot = useScope(scope)
  const entry = owner?.provider || null
  const path = Array.isArray(entry?.settingsPath) ? [...entry.settingsPath] : []
  const profile = snapshot.status === 'ready' && path.length ? at(snapshot.value, path) : undefined
  const initialDefault = modeOf(profile?.defaultInput) === 'vision' ? 'vision' : 'text'
  const [defaultMode, setDefaultMode] = React.useState(initialDefault)
  const [providerMsg, setProviderMsg] = React.useState('')
  React.useEffect(() => { setDefaultMode(modeOf(profile?.defaultInput) === 'vision' ? 'vision' : 'text') }, [snapshot.revision, entry?.provider])

  if (!entry || entry.settingsNs !== NS) return null
  if (snapshot.status !== 'ready') return React.createElement('div', { style: { marginTop: 12, fontSize: 12, opacity: .7 } }, 'dsh-model-mgr：正在读取模型配置…')
  if (!path.length || !profile || typeof profile !== 'object') return null
  const group = (catalog.groups || []).find(g => g.id === entry.provider)
  const models = group?.models || (Array.isArray(profile.models) ? profile.models.filter(m => m?.id).map(m => ({ id: m.id, name: m.name || m.id })) : [])
  async function saveDefault() { setProviderMsg('保存中…'); try { const before = snapshot.revision; await scope.mutate([{ op: 'set', path: [...path, 'defaultInput'], value: inputOf(defaultMode) }], before); setProviderMsg(scope.getSnapshot().revision === before ? '⚠ 保存未生效，revision 可能冲突；已刷新。' : '✅ Provider 默认能力已保存') } catch (e) { setProviderMsg(`❌ ${e?.message || e}`) } }

  return React.createElement('section', { style: { marginTop: 14, padding: 14, border: '1px solid rgba(127,127,127,.24)', borderRadius: 10 } },
    React.createElement('div', { style: { fontWeight: 800, marginBottom: 4 } }, '模型能力 · dsh-model-mgr'),
    React.createElement('div', { style: { fontSize: 12, opacity: .7, marginBottom: 12 } }, '声明能力与实际测试结果分开显示；不会根据模型名称自动猜测视觉能力。'),
    labelled('未声明模型的默认输入能力', React.createElement('div', { style: { display: 'flex', gap: 8 } }, React.createElement('select', { style: { ...control, flex: 1 }, value: defaultMode, onChange: e => setDefaultMode(e.target.value) }, React.createElement('option', { value: 'text' }, '纯文本'), React.createElement('option', { value: 'vision' }, '多模态（文本 + 图片）')), React.createElement('button', { style: button, onClick: saveDefault }, '保存默认值')), 'defaultInput 只是 fallback，不覆盖模型自己的 input。'),
    providerMsg ? React.createElement('div', { style: { fontSize: 12, marginBottom: 8 } }, providerMsg) : null,
    models.length ? models.map(model => React.createElement(ModelRow, { key: model.id, scope, provider: entry.provider, providerPath: path, model, profile, revision: snapshot.revision })) : React.createElement('div', { style: { fontSize: 12, opacity: .72, padding: '10px 0' } }, '当前 Provider 没有可枚举模型。'))
}

const inject = ['slots', 'settingsScope', 'remote']
function apply(ctx) {
  const scope = ctx.settingsScope.bind({ namespace: NS })
  let catalog = { groups: [] }, promise
  const load = () => promise || (promise = ctx.remote.session.modelCatalog().then(r => { if (r?.ok && r.value) catalog = r.value; return catalog }).catch(() => catalog))
  const Extension = owner => { const [, redraw] = React.useReducer(x => x + 1, 0); React.useEffect(() => { load().then(redraw) }, []); return React.createElement(CapabilityPanel, { scope, catalog, owner }) }
  ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, key: NS }, Extension))
}
module.exports = { inject, apply }
return module.exports; } });
