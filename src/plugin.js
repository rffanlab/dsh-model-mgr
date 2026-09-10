import { PROBE_PATH, createProbeHandler } from './probe.js'

export { PROBE_PATH, runTextProbe, runVisionProbe } from './probe.js'
export * from './core.js'

export const name = 'dsh-model-mgr'
export const inject = ['llm']

/**
 * Host half. The GUI itself edits native llm-pi-ai settings through the client
 * settingsScope; the Host half only exposes a tiny same-origin diagnostics
 * endpoint so provider credentials never enter browser code.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: PROBE_PATH,
      handler: createProbeHandler(ctx),
    }), 'dsh-model-mgr: diagnostics route')
  })
}
