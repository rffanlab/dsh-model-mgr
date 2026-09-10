import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const PROBE_PATH = '/plugins/dsh-model-mgr/probe'
export const VISION_SENTINEL = 'VISION_427'
const MAX_BODY_BYTES = 16 * 1024
const TEST_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAUAAAABgCAIAAADjKTx/AAAE80lEQVR4nO3Y30uTexzA8aczKQZJBk5I77zZyPDXkNL5PGythhdFoGjRRSjdSeJdF0J4F/0JZWzOG8XY8KIfZM3GQqVuJt64oF01HaiY0kbWSr9dPOc8jHM6nsM5C/no+3X1fH9sz74X7z26I0opDYBMv+33BwDw3xEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAgGAEDghEwIBgBA4IRMCAYAQOCETAg2AEM+Pbt28Fg0BoGAoHFxcWKigpzmEwmA4GAz+e7ePFiJpPRNM1aGh0ddbvdra2tbrd7bGzMnLTb7T6fz3o3a/NPPXv2zG63m9ehUEjX9cbGxhcvXmiadu3aNa/X6/V629raKisrS3NUQB04iUSiq6vLvM7lck6nUyl14sQJc6ahoSGTySilIpFIT0+PtfT8+XOPx7O5uamU2tzc9Hg8L1++NFfb29vj8bj5cut9/urTp0+tra3l5eVKqbW1NcMwdnZ2UqmUy+Uq3vbw4cM7d+6U7rg41A5gwN+/f6+trf327ZtSampqanBwUBWFd+rUqffv3yulCoXC69evrSW/3z8/P2+9ydzc3IULF8zVmZkZwzDM+T0C7u/vn5ycNDekUqlHjx4ppfL5vMPhsPbs7u42Njaurq6W7LQ43A7gn9A2m+3cuXNv3rzRNO3p06dXrlwpXr17966u6zdv3pydndV13ZpPpVJNTU3WsLm5eWlpybw+f/68pmnxeHyPm87Ozmaz2Z6eHnPocrm6u7s1TYtEIpcvX7a2PX78uKWlpaqq6n+eEfjdfn+D/BITExNDQ0NKqTNnzpiP4uIn58ePH0OhUH19/fDwsLVUXV29vb1t7fn8+XNNTY21Go/HdV1Xf/ME/vLly9mzZ1dWVv60IZ1O19XVra2tWTOGYbx7965UxwQO4BNY07SOjo6ZmZmFhYWmpqaysjJrfn19fX5+/uTJk319fbFY7P79+9bS6dOnk8mkNUwmk3V1ddbQ6/XabLZXr1799HbRaDSXy12/ft3r9ebz+Rs3bmials/nr169GgwGHQ6Hue3t27cVFRVOp7O0h8Whtt/fIL+Kz+e7detWNBo1h+aDcX19vaam5sOHD0qpVCrV0tJiLU1PT3s8nq2tLfXHj1ixWEwVPVETiUR7e/se/wMX32h3d7ezs3N8fLx4qbOzM5FIlOqAgFKq7J8Tl+nSpUvDw8P37t0rnqysrBwZGenu7rbb7TabLRQKWUuBQGB5ednn8x07dqxQKAwMDPj9/uLXGoZx9OjRr1+//pu7h8Ph6enpjY2NBw8eHD9+/MmTJ+l0OpvNGoZRktMBpiNKqf3+DPKEw+FwOGxe9/b29vb27uenwSFGwIBgB/NHLOCQIGBAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYEAwAgYEI2BAMAIGBCNgQDACBgQjYE+wGtuO8AGvfWYQAAAABJRU5ErkJggg=='

function writeJson(res, status, value) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
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

  const admitted = await attachments.admitPromptContent([
    { type: 'text', text: '请读取图片里的大写英文和数字，只返回内容。' },
    { type: 'image', mediaType: 'image/png', data: TEST_PNG_BASE64, name: 'dsh-model-mgr-vision-test.png' },
  ])
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
      message: recognized
        ? '视觉通路正常。'
        : '请求成功且图片通路已走通，但视觉识别结果不符合预期。',
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
      const result = kind === 'vision'
        ? await runVisionProbe(ctx, provider, model)
        : await runTextProbe(ctx, provider, model)
      writeJson(res, 200, result)
    } catch (error) {
      writeJson(res, 200, { ok: false, layer: 'provider', error: errorView(error) })
    }
  }
}
