import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyVisionResult,
  createInputOp,
  modelFieldPath,
  normalizeInput,
  positiveIntegerOrUndefined,
  providerFieldPath,
  resolveEditableModels,
} from '../src/core.js'

test('input modes preserve inherit semantics', () => {
  assert.equal(normalizeInput(undefined), 'inherit')
  assert.equal(normalizeInput(['text']), 'text')
  assert.equal(normalizeInput(['text', 'image']), 'vision')
  assert.deepEqual(createInputOp(['providers', 'local', 'models', 0, 'input'], 'inherit'), {
    op: 'unset', path: ['providers', 'local', 'models', 0, 'input'],
  })
  assert.deepEqual(createInputOp(['x'], 'vision'), { op: 'set', path: ['x'], value: ['text', 'image'] })
})

test('explicit models use a nested array path without replacing the model', () => {
  const profile = { models: [{ id: 'qwen', contextWindow: 131072, maxTokens: 32768, compat: { foo: true } }] }
  const [model] = resolveEditableModels(profile)
  assert.equal(model.kind, 'models')
  assert.deepEqual(modelFieldPath(['providers', 'local'], model, 'input'), ['providers', 'local', 'models', 0, 'input'])
  assert.deepEqual(providerFieldPath(['providers', 'local'], 'defaultInput'), ['providers', 'local', 'defaultInput'])
  assert.deepEqual(profile.models[0].compat, { foo: true })
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
