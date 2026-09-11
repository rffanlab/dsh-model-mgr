# dsh-model-mgr

[中文](README.md) | English

A lightweight GUI for DeepSeek Harness native model configuration: manage input modalities, Context Window, Max Tokens **per model**, and verify text/vision paths directly.

> “Text + image” only declares that a specific model/endpoint accepts image input. It cannot give vision capability to a text-only model or inference server.

## Current release

Current version: **0.1.4**.

0.1.4 focuses on lower intrusion and a reliable vision probe:

- the normal Provider-level “default multimodal” editor is removed;
- `input` is changed per model only;
- Provider capability panels and model rows both start collapsed;
- legacy `defaultInput: [text, image]` values are detected and shown with an explicit cleanup action instead of being silently changed;
- the previously truncated probe PNG is replaced;
- CI now validates PNG chunks and inflates IDAT data so a malformed fixture cannot ship again.

## Entry points

Primary:

```text
Settings
→ Models
→ expand an llm-pi-ai Provider
→ Model capabilities · dsh-model-mgr
```

Compatibility entry:

```text
Settings
→ Plugins
→ Model capabilities
```

Both edit the same native DSH `llm-pi-ai` settings. There is no shadow configuration.

## Interaction

The UI uses two disclosure levels. The whole plugin panel starts collapsed:

```text
Model capabilities · dsh-model-mgr                 >
```

After opening it, model rows are still collapsed:

```text
qwen3.8-27b · Inherit DSH default/catalog          >
qwen-vl      · Text + image                        >
```

Opening a model reveals:

- input capability
- Context Window
- Max Tokens
- Test text
- Test vision
- Save / Restore inheritance

## Per-model input capability

| UI | Native DSH write semantics |
|---|---|
| Inherit DSH default/catalog | `unset` the model's own `input` |
| Text only | `input: [text]` |
| Text + image | `input: [text, image]` |

The plugin never infers capability from names such as `Qwen-VL` or `Vision`.

For explicit self-hosted `models`, the target model is patched directly:

```yaml
llm-pi-ai:
  providers:
    local-vllm:
      models:
        - id: qwen-model
          input: [text, image]
          contextWindow: 131072
          maxTokens: 32768
```

For catalog-backed Providers, the plugin uses minimal `modelOverrides`:

```yaml
llm-pi-ai:
  providers:
    my-provider:
      modelOverrides:
        qwen-model:
          input: [text, image]
          contextWindow: 131072
```

Writes use nested path operations, so changing `input` does not erase unrelated `compat`, reasoning, or other fields.

## Provider defaults

Starting with 0.1.4, the plugin **does not expose a normal Provider-level `defaultInput` editor**.

DSH itself defaults `defaultInput` to `[text]`, and it is only a fallback. This plugin is intended to declare capability per model, so it no longer encourages turning an entire Provider into a multimodal route family.

If an earlier plugin version already wrote:

```yaml
defaultInput: [text, image]
```

the capability panel shows a warning and an explicit action:

```text
Clear Provider-wide multimodal default
```

That action unsets `defaultInput`, returning the route to native DSH default/catalog behavior. No automatic migration mutates user settings.

## Text probe

**Test text** sends a minimal request through the currently configured DSH `ctx.llm` route:

```text
只回复 MODEL_OK
```

The UI reports success, latency, and Provider errors.

## Vision probe

**Test vision** performs these steps:

1. Resolve the exact model through `ctx.llm.resolveModelInfo(provider, model)`.
2. If DSH does not declare `image`, stop with a DSH-layer result and do not send an image.
3. Use the plugin's CI-validated 320×96 RGB PNG containing `VISION_427`.
4. Admit/store it through the first compatible attachment API:
   - `admitPromptContent()`
   - `saveImages()`
   - `saveImage()`
5. Send the image through the same Provider / Model route.
6. Separate DSH attachment failures, Provider inference failures, and recognition mismatches.

Diagnostic meaning:

- **DSH layer:** image input is undeclared, or attachment admission/storage fails;
- **Provider layer:** DSH accepted the image but the inference endpoint rejected or interrupted the request;
- **Model mismatch:** the request succeeded but the answer did not identify `VISION_427`;
- **Vision path OK:** the model returned `VISION_427`.

Earlier releases could show:

```text
Unsupported or malformed image data
```

because the bundled PNG was truncated. 0.1.4 replaces it with a complete PNG and adds a decompression-level regression test.

## Writes and conflicts

The browser binds only the native namespace:

```text
settingsScope.bind({ namespace: "llm-pi-ai" })
```

and writes through:

```text
settingsScope.mutate(ops, expectedRevision)
```

Therefore:

- inheritance is a real `unset`;
- the plugin never rebuilds an entire Provider object;
- stale revisions are rejected by DSH;
- untouched fields remain untouched.

## Security boundaries

- API keys are never read, stored, or displayed by browser code.
- Plaintext `.credentials.yaml` is never read.
- Probes reuse DSH's existing Provider / credential path.
- Providers are never silently scanned or probed.
- Model names never auto-enable multimodal support.
- The vision probe uses only the bundled fixed PNG.
- Arbitrary local user files are never uploaded automatically.
- Capability mutations require an explicit user save.

Host diagnostics endpoint:

```text
/plugins/dsh-model-mgr/probe
```

It accepts only `provider`, `model`, and `kind: text|vision`.

## Install / upgrade

Web profile:

```bash
dsh plugin --profile web add github:rffanlab/dsh-model-mgr
```

Upgrade:

```bash
dsh plugin --profile web update dsh-model-mgr
```

If installed in the default profile:

```bash
dsh plugin --profile default update dsh-model-mgr
```

After upgrading, restart the DSH Web Host and hard-refresh the browser with `Ctrl+F5`.

## Development

Node.js 20+:

```bash
npm test
npm run check
npm run packcheck
```

Current tests cover:

- inherit / text / text+image mapping;
- explicit `models` nested paths;
- catalog `modelOverrides`;
- positive integer validation;
- Web client bundle registration;
- Provider/model collapsed defaults;
- absence of a normal Provider-level “save default” control;
- PNG signature, chunk completeness, and IDAT decompression.

## Layout

```text
dsh-model-mgr/
├─ src/
│  ├─ core.js
│  ├─ vision-fixture.js
│  ├─ probe.js
│  └─ plugin.js
├─ lib/
│  └─ client.js
├─ test/
│  ├─ core.test.js
│  ├─ client-bundle.test.js
│  └─ vision-fixture.test.js
├─ README.md
├─ README.en.md
└─ package.json
```

## Design principles

1. **Native DSH settings are the single source of truth.**
2. **Model capability is configured per model by default, not widened to an entire Provider.**
3. **Declared capability and observed probe results stay separate.**
4. **Conservative defaults.**
5. **No DSH fork, no React DOM hacks, no shadow config.**

## License

MIT
