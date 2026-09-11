import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSettingsPath,
  classifyVisionResult,
  createExplicitModelOp,
  createInputOp,
  modelFieldPath,
  normalizeInput,
  positiveIntegerOrUndefined,
  providerFieldPath,
  resolveEditableModels,
} from '../src/core.js'

test('input modes preserve inherit semantics with string-only settings paths', () => {
  assert.equal(normalizeInput(undefined), 'inherit')
  assert.equal(normalizeInput(['text']), 'text')
  assert.equal(normalizeInput(['text', 'image']), 'vision')
  assert.deepEqual(createInputOp(['providers', 'local', 'modelOverrides', 'qwen', 'input'], 'inherit'), {
    op: 'unset', path: ['providers', 'local', 'modelOverrides', 'qwen', 'input'],
  })
  assert.deepEqual(createInputOp(['x'], 'vision'), { op: 'set', path: ['x'], value: ['text', 'image'] })
  assert.throws(() => assertSettingsPath(['providers', 'local', 'models', 0, 'input']), /string segments/)
})

test('explicit model edits replace the models array while preserving unknown fields', () => {
  const profile = {
    models: [
      { id: 'qwen', contextWindow: 131072, maxTokens: 32768, compat: { foo: true }, reasoning: { effort: 'high' } },
      { id: 'other', compat: { untouched: true } },
    ],
  }
  const [model] = resolveEditableModels(profile)
  assert.equal(model.kind, 'models')
  assert.throws(
    () => modelFieldPath(['providers', 'local'], model, 'input'),
    /Replace the models array/,
  )

  const op = createExplicitModelOp(['providers', 'local'], profile.models, 0, {
    input: ['text', 'image'],
    contextWindow: 128000,
    maxTokens: undefined,
  })
  assert.deepEqual(op.path, ['providers', 'local', 'models'])
  assert.ok(op.path.every(segment => typeof segment === 'string'))
  assert.deepEqual(op.value[0].input, ['text', 'image'])
  assert.equal(op.value[0].contextWindow, 128000)
  assert.equal('maxTokens' in op.value[0], false)
  assert.deepEqual(op.value[0].compat, { foo: true })
  assert.deepEqual(op.value[0].reasoning, { effort: 'high' })
  assert.deepEqual(op.value[1], profile.models[1])
  assert.deepEqual(providerFieldPath(['providers', 'local'], 'defaultInput'), ['providers', 'local', 'defaultInput'])
})

test('catalog providers use modelOverrides as the minimal write surface', () => {
  const profile = { modelOverrides: { qwen: { contextWindow: 131072 } } }
  const [model] = resolveEditableModels(profile)
  assert.equal(model.kind, 'override')
  assert.deepEqual(modelFieldPath(['providers', 'catalog'], model, 'input'), ['providers', 'catalog', 'modelOverrides', 'qwen', 'input'])
})

test('positive integer parser accepts blank inheritance and rejects invalid values', () => {
  assert.equal(positiveIntegerOrUndefined(''), undefined)
  assert.equal(positiveIntegerOrUndefined('32768'), 32768)
  assert.throws(() => positiveIntegerOrUndefined('0'))
  assert.throws(() => positiveIntegerOrUndefined('1.5'))
})

test('vision result distinguishes DSH, provider and model layers', () => {
  assert.equal(classifyVisionResult({ declaredImage: false }).layer, 'dsh')
  assert.equal(classifyVisionResult({ declaredImage: true, requestOk: false, error: '400' }).layer, 'provider')
  assert.equal(classifyVisionResult({ declaredImage: true, requestOk: true, responseText: 'VISION_427' }).status, 'ok')
  assert.equal(classifyVisionResult({ declaredImage: true, requestOk: true, responseText: 'WRONG' }).layer, 'model')
})
