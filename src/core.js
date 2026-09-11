export const TEXT_INPUT = Object.freeze(['text'])
export const VISION_INPUT = Object.freeze(['text', 'image'])

export function cloneJson(value) {
  return value == null ? value : structuredClone(value)
}

export function getAtPath(root, path) {
  let current = root
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

export function normalizeInput(value) {
  if (!Array.isArray(value) || value.length === 0) return 'inherit'
  const set = new Set(value)
  if (set.has('text') && set.has('image')) return 'vision'
  if (set.has('text')) return 'text'
  return 'inherit'
}

export function inputForMode(mode) {
  if (mode === 'text') return [...TEXT_INPUT]
  if (mode === 'vision') return [...VISION_INPUT]
  return undefined
}

export function assertSettingsPath(path) {
  if (!Array.isArray(path) || path.some(segment => typeof segment !== 'string')) {
    throw new TypeError('DSH settings paths must contain only string segments')
  }
  return path
}

export function providerPath(entry) {
  if (!entry || !Array.isArray(entry.settingsPath) || entry.settingsPath.length === 0) {
    throw new Error('Provider does not expose a writable settingsPath')
  }
  return [...assertSettingsPath(entry.settingsPath)]
}

export function resolveEditableModels(profile) {
  if (!profile || typeof profile !== 'object') return []
  if (Array.isArray(profile.models)) {
    return profile.models
      .map((model, index) => ({ kind: 'models', index, id: typeof model?.id === 'string' ? model.id : '', value: model }))
      .filter(model => model.id)
  }
  const overrides = profile.modelOverrides && typeof profile.modelOverrides === 'object'
    ? profile.modelOverrides
    : {}
  return Object.entries(overrides).map(([id, value]) => ({ kind: 'override', id, value }))
}

export function modelFieldPath(providerSettingsPath, model, field) {
  const provider = assertSettingsPath(providerSettingsPath)
  if (model.kind === 'models') {
    throw new Error('Explicit models are arrays; DSH wire paths are string-only. Replace the models array instead of addressing an index.')
  }
  if (model.kind === 'override') return [...provider, 'modelOverrides', model.id, field]
  throw new Error(`Unsupported model edit kind: ${String(model?.kind)}`)
}

export function providerFieldPath(providerSettingsPath, field) {
  return [...assertSettingsPath(providerSettingsPath), field]
}

export function createSetOp(path, value) {
  return { op: 'set', path: [...assertSettingsPath(path)], value: cloneJson(value) }
}

export function createUnsetOp(path) {
  return { op: 'unset', path: [...assertSettingsPath(path)] }
}

export function createInputOp(path, mode) {
  const value = inputForMode(mode)
  return value === undefined ? createUnsetOp(path) : createSetOp(path, value)
}

export function createExplicitModelOp(providerSettingsPath, models, index, changes) {
  const provider = assertSettingsPath(providerSettingsPath)
  if (!Array.isArray(models) || !models[index] || typeof models[index] !== 'object') {
    throw new Error('Explicit model row is not available')
  }
  const next = cloneJson(models)
  const row = { ...next[index] }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete row[key]
    else row[key] = cloneJson(value)
  }
  next[index] = row
  return createSetOp([...provider, 'models'], next)
}

export function positiveIntegerOrUndefined(value) {
  if (value === '' || value == null) return undefined
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('Value must be a positive integer')
  return parsed
}

export function classifyVisionResult({ declaredImage, requestOk, responseText, error }) {
  if (!declaredImage) {
    return { layer: 'dsh', status: 'blocked', message: 'DSH 当前没有把该模型声明为图片输入模型；未发送测试图片。' }
  }
  if (!requestOk) {
    return { layer: 'provider', status: 'failed', message: error || '图片已交给 DSH，但 Provider / 推理服务拒绝了请求。' }
  }
  const normalized = String(responseText || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
  if (normalized.includes('VISION_427')) {
    return { layer: 'vision', status: 'ok', message: '视觉通路正常，模型识别到 VISION_427。' }
  }
  return { layer: 'model', status: 'mismatch', message: '请求成功且图片通路已走通，但视觉识别结果不符合预期。' }
}
