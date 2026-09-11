import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { VISION_SENTINEL, VISION_TEST_PNG_BASE64, VISION_TEST_PNG_BYTES } from './vision-fixture.js'

export const PROBE_PATH = '/plugins/dsh-model-mgr/probe'
const MAX_BODY_BYTES = 16 * 1024

function writeJson(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(value))
}

async function readJson(req) {
  let total = 0
  const chunks = []
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function failureOf(reason) {
  if (!reason || typeof reason !== 'object') return undefined
  if (reason.kind !== 'error' && reason.kind !== 'aborted') return undefined
  return reason.failure
}

async function collectText(llm, request) {
  let text = ''
  let failure
  for await (const chunk of llm.stream(request)) {
    if (chunk.type === 'text-delta') text += chunk.text
    if (chunk.type === 'block-end' && chunk.block?.type === 'text' && text.length === 0) text += chunk.block.text
    if (chunk.type === 'finish') failure = failureOf(chunk.reason)
  }
  if (failure) {
    const error = new Error(failure.message || failure.code || 'LLM request failed')
    error.code = failure.code
    error.status = failure.status
    error.requestId = failure.requestId
    throw error
  }
  return text.trim()
}

function errorView(error) {
  return {
    message: error?.message || String(error),
    ...(error?.code ? { code: error.code } : {}),
    ...(Number.isInteger(error?.status) ? { status: error.status } : {}),
    ...(error?.requestId ? { requestId: error.requestId } : {}),
  }
}

function imageInput() {
  return {
    data: new Uint8Array(VISION_TEST_PNG_BYTES),
    mediaType: 'image/png',
    name: 'dsh-model-mgr-vision-test.png',
  }
}

/**
 * Admit the fixed probe image across DSH attachment API generations.
 * Every branch ends in durable prompt content accepted by ctx.llm.
 */
export async function admitVisionPrompt(attachments) {
  const text = { type: 'text', text: '请读取图片里的大写英文和数字，只返回内容。' }
  if (typeof attachments?.admitPromptContent === 'function') {
    return attachments.admitPromptContent([
      text,
      { type: 'image', mediaType: 'image/png', data: VISION_TEST_PNG_BASE64, name: 'dsh-model-mgr-vision-test.png' },
    ])
  }

  const input = imageInput()
  if (typeof attachments?.saveImages === 'function') {
    const refs = await attachments.saveImages([input])
    const ref = refs?.[0]
    if (!ref) throw new Error('attachments.saveImages returned no image reference')
    return [text, { type: 'image', attachment: ref }]
  }

  if (typeof attachments?.saveImage === 'function') {
    const ref = await attachments.saveImage(input)
    if (!ref) throw new Error('attachments.saveImage returned no image reference')
    return [text, { type: 'image', attachment: ref }]
  }

  const methods = attachments && typeof attachments === 'object'
    ? Object.keys(attachments).filter(key => typeof attachments[key] === 'function').sort()
    : []
  throw new Error(`当前 attachments provider 不支持图片持久化；可用方法: ${methods.join(', ') || 'none'}`)
}

export async function runTextProbe(ctx, provider, model) {
  const started = performance.now()
  const text = await collectText(ctx.llm, {
    provider,
    model,
    maxTokens: 32,
    messages: [createUserMessage({ content: [{ type: 'text', text: '只回复 MODEL_OK' }] })],
  })
  return {
    ok: text.length > 0,
    kind: 'text',
    provider,
    model,
    latencyMs: Math.round(performance.now() - started),
    text,
    exact: text.trim().toUpperCase() === 'MODEL_OK',
  }
}

export async function runVisionProbe(ctx, provider, model) {
  const info = await ctx.llm.resolveModelInfo(provider, model)
  const declaredImage = Array.isArray(info.inputModalities) && info.inputModalities.includes('image')
  if (!declaredImage) {
    return {
      ok: false,
      kind: 'vision',
      layer: 'dsh',
      provider,
      model,
      declaredImage: false,
      message: 'DSH 当前没有把该模型解析为图片输入模型；未发送测试图片。',
    }
  }

  const attachments = ctx.get('attachments')
  if (!attachments) {
    return {
      ok: false,
      kind: 'vision',
      layer: 'dsh',
      provider,
      model,
      declaredImage: true,
      message: '当前 Harness 未挂载 attachments 服务，无法执行内置视觉测试。',
    }
  }

  let admitted
  try {
    admitted = await admitVisionPrompt(attachments)
  } catch (error) {
    return {
      ok: false,
      kind: 'vision',
      layer: 'dsh',
      provider,
      model,
      declaredImage: true,
      error: errorView(error),
      message: `DSH 图片准入失败：${error?.message || error}`,
    }
  }

  const started = performance.now()
  try {
    const text = await collectText(ctx.llm, {
      provider,
      model,
      maxTokens: 32,
      messages: [createUserMessage({ content: admitted })],
    })
    const normalized = text.toUpperCase().replace(/[^A-Z0-9_]/g, '')
    const recognized = normalized.includes(VISION_SENTINEL)
    return {
      ok: recognized,
      kind: 'vision',
      layer: recognized ? 'vision' : 'model',
      provider,
      model,
      declaredImage: true,
      latencyMs: Math.round(performance.now() - started),
      text,
      recognized,
      message: recognized ? '视觉通路正常。' : '请求成功且图片通路已走通，但视觉识别结果不符合预期。',
    }
  } catch (error) {
    return {
      ok: false,
      kind: 'vision',
      layer: 'provider',
      provider,
      model,
      declaredImage: true,
      latencyMs: Math.round(performance.now() - started),
      error: errorView(error),
      message: '图片已经由 DSH 发往模型服务，但 Provider / 推理服务器拒绝或中断了请求。',
    }
  }
}

export function createProbeHandler(ctx) {
  return async (req, res) => {
    if (req.method !== 'POST') {
      writeJson(res, 405, { ok: false, error: { message: 'Method Not Allowed' } })
      return
    }
    try {
      const body = await readJson(req)
      const provider = typeof body.provider === 'string' ? body.provider.trim() : ''
      const model = typeof body.model === 'string' ? body.model.trim() : ''
      const kind = body.kind
      if (!provider || !model || (kind !== 'text' && kind !== 'vision')) {
        writeJson(res, 400, { ok: false, error: { message: 'provider, model and kind(text|vision) are required' } })
        return
      }
      const result = kind === 'vision' ? await runVisionProbe(ctx, provider, model) : await runTextProbe(ctx, provider, model)
      writeJson(res, 200, result)
    } catch (error) {
      writeJson(res, 200, { ok: false, layer: 'provider', error: errorView(error) })
    }
  }
}
