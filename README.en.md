# dsh-model-mgr

[中文](README.md) | English

> [!IMPORTANT]
> **This project is no longer maintained.**
>
> Recent DeepSeek Harness releases now provide the main capabilities that originally motivated this plugin, including:
>
> - per-model input type configuration (Text / Image);
> - Context Window;
> - Max Tokens;
> - custom Provider model discovery;
> - model-capacity discovery for local / OpenAI-compatible endpoints.
>
> As a result, `dsh-model-mgr` has completed its transitional role and **will not be updated for future DeepSeek Harness releases**.
>
> **Use the native Settings → Models experience in the latest DeepSeek Harness instead of installing this plugin.**
>
> This repository remains available as a historical implementation and troubleshooting/design reference. If an older plugin release wrote explicit `contextWindow`, `maxTokens`, `defaultInput`, or similar overrides, review and remove obsolete overrides in the native DSH model settings before uninstalling.

## Project status

- Status: **Maintenance stopped**
- Final release: **0.1.7**
- Recommended replacement: **DeepSeek Harness native Models settings**
- Repository purpose: historical implementation, troubleshooting, and design reference

## Historical notes

0.1.7 was the final maintained release.

0.1.7 fixes an important issue that could interfere with local-model context detection. Earlier builds read the schema-resolved `settingsScope.snapshot.value`, then used those resolved values as the write baseline. Saving only a capability such as image input could therefore materialize DSH-resolved `contextWindow` / `maxTokens` values into the user layer. Since explicit model capacities have higher priority than catalog/default resolution, later DSH upgrades or re-detection could appear to stop working.

Starting with 0.1.7:

- `snapshot.value` is used only to show the **current DSH-resolved result**;
- writes are based on `snapshot.user`, the **raw user layer**;
- when the user never configured `contextWindow` / `maxTokens`, those inputs stay blank;
- blank capacity inputs are not materialized and remain owned by DSH / the catalog;
- historical explicit capacity overrides are detected and can be removed with **Clear capacity override, restore DSH auto detection**;
- the native **Settings → Models** page remains untouched; all plugin UI stays under **Settings → Plugins → Model capabilities**.

## Entry point

```text
Settings
→ Plugins
→ Model capabilities
```

The plugin does not inject `settings.models.provider-card`.

## Features

- Per-model `inherit / text / text + image` capability control.
- Optional per-model `Context Window` and `Max Tokens` overrides.
- Blank capacity fields remain inherited from DSH / catalog resolution.
- Shows the current DSH-resolved Context / Max Tokens as read-only hints.
- Detects explicit capacity overrides and offers explicit cleanup.
- Provider and model rows start collapsed.
- Text connectivity probe.
- Vision path probe.
- Vision failures are separated into DSH image admission, provider/inference service, and model-recognition layers.
- Reads/writes only native `llm-pi-ai` settings; no shadow config.
- API keys never enter the plugin UI.

## Historical install commands (not recommended)

> [!WARNING]
> The commands below are retained only for historical reference. Recent DeepSeek Harness releases provide the relevant functionality natively; new installations of this plugin are not recommended.

Web profile:

```bash
dsh plugin --profile web add github:rffanlab/dsh-model-mgr
```

Update an existing install:

```bash
dsh plugin --profile web update dsh-model-mgr
```

If installed in the default profile:

```bash
dsh plugin --profile default update dsh-model-mgr
```

Restart the DSH Web Host after updating and perform one hard browser refresh (`Ctrl+F5`).

## Context / Max Tokens inheritance

DSH resolves capacity in this order:

```text
explicit contextWindow / maxTokens on the model entry
        ↓
installed catalog model with the same id
        ↓
Provider defaultContextWindow / defaultMaxTokens
```

Therefore, once user settings contain:

```yaml
models:
  - id: local-qwen
    contextWindow: 128000
    maxTokens: 32000
```

those explicit values win over later catalog/default resolution.

0.1.7 keeps the two kinds of values separate in the UI:

- **Input value**: a real user override.
- **Current DSH-resolved value**: display-only; saving multimodal capability does not write it back.

When upgrading from 0.1.6 or older, if a local model still reports the wrong context, expand that model. If the UI says it has a manual capacity override, click:

```text
Clear capacity override, restore DSH auto detection
```

That action removes only `contextWindow` / `maxTokens`. It preserves `input`, `compat`, reasoning metadata, and other model fields.

## Per-model input capability

| UI | Native DSH write semantics |
|---|---|
| Inherit DSH default/catalog | clear the model's explicit `input` |
| Text only | `input: [text]` |
| Text + image | `input: [text, image]` |

The plugin never infers capabilities from names such as `Qwen-VL` or `Vision`.

## Explicit `models` providers

DSH settings wire paths are `string[]`, so array indices cannot be sent as path segments. For an explicit `models` array, the plugin writes a cloned **raw user array**, changes only the selected row, and writes the array back.

The important 0.1.7 rule is that the write baseline is no longer the DSH-resolved array. Resolved capacities therefore cannot be accidentally frozen into user settings.

If raw user settings contain only:

```yaml
models:
  - id: local-qwen
```

enabling image input produces:

```yaml
models:
  - id: local-qwen
    input: [text, image]
```

It does **not** add `contextWindow` or `maxTokens` unless the user explicitly entered them.

## Catalog-backed providers

Catalog-backed providers still use minimal `modelOverrides`:

```yaml
llm-pi-ai:
  providers:
    nvidia:
      modelOverrides:
        vision-model:
          input: [text, image]
```

Leaving capacity inputs blank keeps those override fields absent, so the installed catalog continues to own the capacity.

## Provider default capability

The plugin does not expose a Provider-level `defaultInput` editor.

If an older release left:

```yaml
defaultInput: [text, image]
```

the Plugins page shows an explicit cleanup action instead of changing it silently.

## Text probe

**Test text** sends a minimal request through the current DSH `ctx.llm` route and asks the model to answer:

```text
MODEL_OK
```

## Vision probe

**Test vision**:

1. checks whether DSH currently resolves the model as accepting `image` input;
2. generates a valid PNG test image at runtime;
3. embeds `VISION_427` in the image;
4. admits the image through the current Harness attachment service;
5. sends it through the current DSH LLM route;
6. separates DSH, provider, and model-recognition failures.

Attachment API compatibility:

```text
admitPromptContent() → saveImages() → saveImage()
```

## Security boundaries

- Never read, store, or display API keys in browser code.
- Never read plaintext `.credentials.yaml`.
- Probes reuse the current DSH Provider / credential path.
- Never silently probe every Provider.
- Never enable multimodal support based on model names.
- Never upload arbitrary local user images automatically.
- Never auto-delete historical capacity overrides; cleanup requires an explicit user action.

Host diagnostics endpoint:

```text
/plugins/dsh-model-mgr/probe
```

## Development

Node.js 20+:

```bash
npm run check
npm test
npm run packcheck
```

Regression tests cover:

- only registering `settings.plugins.tab`;
- collapsed Provider/model UI;
- string-only `settings/mutate` paths;
- preserving unknown fields and sibling models in explicit arrays;
- **never materializing resolved capacities into the user layer**;
- capacity cleanup removing only `contextWindow` / `maxTokens`;
- vision PNG integrity and IDAT decompression.

## License

MIT
