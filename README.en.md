# dsh-model-mgr

[中文](README.md) | English

**A practical GUI for DeepSeek Harness native model settings: manage input modalities, Context Window, Max Tokens, and verify text/vision paths without hand-editing YAML.**

The default project documentation is the Chinese [`README.md`](README.md). This file is the English version.

> “Multimodal (text + image)” means **declaring to DSH that the model/endpoint accepts image input**. It cannot make a text-only model or inference server magically gain vision support.

## Current release

Current version: **0.1.1**.

0.1.1 fixes the case where the first Web UI build could disappear entirely and now provides two entry points:

1. **Primary:** Settings → Models → an llm-pi-ai Provider → Model capabilities · dsh-model-mgr
2. **Compatibility:** Settings → Plugins → Model capabilities

Both surfaces edit the same native DSH `llm-pi-ai` settings. There is no shadow configuration.

## Features

The current release covers P0–P4 of the development plan:

- Extends the official `settings.models.provider-card` keyed slot without modifying Harness Web core.
- Adds a `settings.plugins.tab` compatibility entry so a Models-page slot mismatch does not leave the plugin with no UI.
- Reads and writes only native DSH `llm-pi-ai` settings; no shadow model database.
- Provider `defaultInput`: text or text + image.
- Per-model `input`: inherit, text, or text + image.
- `contextWindow` and `maxTokens` editing.
- Revision-aware writes through `settingsScope.mutate(..., expectedRevision)`.
- Nested patches for explicit `models`, preserving unrelated fields.
- Minimal `modelOverrides.<modelId>` patches for catalog-backed providers instead of copying the catalog.
- One-click text connectivity probe.
- One-click vision-path probe.
- Vision diagnostics separated into DSH declaration, provider/inference-server, and model-recognition layers.
- API keys never enter the plugin UI.

Reasoning / Thinking is intentionally deferred. In DSH it also involves reasoning efforts, thinking formats, chat-template kwargs, and provider-specific protocol behavior, so a simple on/off switch would be misleading.

## Installation

Default profile:

```bash
dsh plugin --profile default add github:rffanlab/dsh-model-mgr
```

Web profile:

```bash
dsh plugin --profile web add github:rffanlab/dsh-model-mgr
```

### Upgrade from 0.1.0

If the first release is already installed:

```bash
dsh plugin --profile web update dsh-model-mgr
```

Or, when installed in the default profile:

```bash
dsh plugin --profile default update dsh-model-mgr
```

Then **restart the DSH Web Host and perform one hard browser refresh (Ctrl+F5)**. The package version was bumped to 0.1.1 so an existing install does not keep stale 0.1.0 client bytes.

`cordis.patch.yml` activates the Host half and `dsh.client` loads the Web client.

## Usage

### Primary Models entry

Open:

```text
Settings
→ Models
→ expand an llm-pi-ai Provider
→ Model capabilities · dsh-model-mgr
```

The capability editor is rendered directly inside that Provider's native card.

### Compatibility Plugins entry

If the current Harness build changes or omits the Models provider-card extension seat, open:

```text
Settings
→ Plugins
→ Model capabilities
```

This view lists configured `llm-pi-ai.providers.*` and exposes the same capability editor.

If **neither entry appears**, the issue is not a Provider setting. It means the Web client bundle is not loaded by the active profile. Update the plugin in the correct profile, restart the Web Host, hard-refresh the browser, and confirm which profile owns the plugin.

## Provider default input

The UI writes either:

```yaml
defaultInput: [text]
```

or:

```yaml
defaultInput: [text, image]
```

`defaultInput` is a fallback. It does not forcibly override a model's explicit `input`.

## Per-model input capability

| UI | Native DSH write semantics |
|---|---|
| Inherit default | `unset` the model's explicit `input` |
| Text only | `input: [text]` |
| Multimodal (text + image) | `input: [text, image]` |

The plugin never infers capabilities from names such as `Qwen-VL` or `Vision`.

## Catalog-backed vs explicit models

For a provider that uses the pi-ai catalog and has no explicit `models` list, the plugin uses a minimal override:

```yaml
llm-pi-ai:
  providers:
    my-provider:
      modelOverrides:
        qwen-model:
          input: [text, image]
          contextWindow: 131072
```

For a self-hosted provider with explicit models:

```yaml
llm-pi-ai:
  providers:
    local-vllm:
      models:
        - id: qwen-model
          contextWindow: 131072
          maxTokens: 32768
          input: [text, image]
```

Writes use nested path operations, so changing `input` does not erase `compat`, reasoning settings, or other untouched fields.

A model-catalog failure no longer removes the capability UI. For explicit `models` providers, 0.1.1 falls back to the native settings model list.

## Text probe

Click **Test text** to send a minimal request through the currently configured DSH `ctx.llm` route:

```text
只回复 MODEL_OK
```

The UI reports visible output, latency, and provider errors. Exact `MODEL_OK` matching is only supplementary; this is a connectivity test, not a generation-quality benchmark.

## Vision probe

Click **Test vision** and the Host performs these steps:

1. Resolve the exact route with `ctx.llm.resolveModelInfo(provider, model)`.
2. If `inputModalities` does not contain `image`, return a **DSH-layer failure** without sending an image.
3. Otherwise admit the plugin's small fixed PNG through `ctx.attachments.admitPromptContent()`.
4. The image contains `VISION_427`.
5. Send that admitted image through the same DSH Provider/Model route.
6. Separate provider rejection from recognition mismatch.

### Three required layers

```text
The model supports Vision
        ↓
The inference service actually loaded Vision
        ↓
DSH declares image input for the route
```

- **DSH layer:** image input is not declared, so no image request is sent.
- **Provider layer:** DSH permits the image, but the inference server / endpoint rejects or interrupts the request.
- **Model layer:** the request succeeds, proving the image path works, but the answer does not match `VISION_427`.

Therefore:

```yaml
input: [text, image]
```

is a capability declaration, not a “turn vision on” switch.

## Writes and conflict handling

The plugin never reads, regex-edits, or overwrites `settings.yaml` directly. The browser binds the native scope:

```text
settingsScope.bind({ namespace: "llm-pi-ai" })
```

and saves structured nested-path operations with the current revision:

```text
settingsScope.mutate(ops, expectedRevision)
```

“Inherit” is represented by a real `unset`, while stale revisions are rejected by the DSH settings mechanism and the current settings are refreshed.

## 0.1.1 Web UI fix

The first release had two fragile client-side paths:

- it called `ctx.remote.session.modelCatalog()` without explicitly declaring the `remote.session` runtime dependency;
- an early bundle revision had a loading → ready React Hook-order hazard that could cause the slot error boundary to retire the extension and leave an apparently empty UI.

0.1.1 fixes this by declaring `remote.session`, making catalog loading non-fatal, keeping all Provider-panel hooks unconditional, aligning the lazy-CJS wrapper with the already proven `dsh-subagent-mgr` shape, adding the Plugins compatibility entry, and adding a smoke test that executes the bundle and verifies both slot registrations.

## Security boundaries

- Never read, store, or display API keys in browser code.
- Never read plaintext `.credentials.yaml`.
- Probes reuse the existing DSH Provider / credential path.
- Never scan or silently probe every Provider.
- Never enable multimodal support based on model names.
- The vision probe uses only the plugin's bundled small fixed PNG.
- Never upload arbitrary local user files automatically.
- Capability changes take effect only after an explicit user save.

The current Host diagnostics endpoint is:

```text
/plugins/dsh-model-mgr/probe
```

It accepts only `provider`, `model`, and `kind: text|vision`; credentials remain on the Harness Host. A later release can further tighten the diagnostics transport access-control boundary.

## Scope

The MVP manages the `llm-pi-ai` family: self-hosted OpenAI-compatible services, vLLM, LM Studio, custom gateways, and other pi-ai routes.

It does not attempt to unify Codex OAuth, the dedicated DeepSeek adapter, or every future adapter in v1.

## Development

Node.js 20+ is required.

```bash
npm test
npm run check
npm run packcheck
```

Tests cover input-mode mapping, inherit-as-unset, nested explicit-model paths, catalog `modelOverrides` paths, positive-integer validation, layered vision classification, and execution of the Web client bundle with verification of both UI slot registrations.

## Project layout

```text
dsh-model-mgr/
├─ src/
│  ├─ core.js       # pure config/capability helpers
│  ├─ probe.js      # Host text/vision diagnostics
│  └─ plugin.js     # Host plugin entry
├─ lib/
│  └─ client.js     # DSH lazy-CJS Web client
├─ test/
│  ├─ core.test.js
│  └─ client-bundle.test.js
├─ README.md        # default Chinese docs
├─ README.en.md     # English docs
├─ package.json
└─ cordis.patch.yml
```

## Design principles

1. **Native DSH settings remain the single source of truth.**
2. **Declared capability and observed probe results stay separate.**
3. **Conservative by default: no vision declaration means text-only behavior.**
4. **No DSH fork, no React DOM hacks, and no shadow config.**

## License

MIT
