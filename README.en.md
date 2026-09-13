# dsh-model-mgr

[中文](README.md) | English

A lightweight GUI for DeepSeek Harness native model configuration: manage input modalities, Context Window, Max Tokens **per model**, and verify text/vision paths directly.

> “Text + image” only declares that a specific model/endpoint accepts image input. It cannot add vision capability to a text-only model or inference server.

## Current release

Current version: **0.1.6**.

Starting with 0.1.6, the plugin **no longer modifies or extends Settings → Models**. The native Models page is left entirely to DeepSeek Harness. All dsh-model-mgr controls now live only under:

```text
Settings
→ Plugins
→ Model capabilities
```

This keeps the native Provider cards, edit controls, and model catalog UI unchanged.

## Features

- UI only under **Settings → Plugins → Model capabilities**.
- Per-model `inherit / text / text + image` capability control.
- Per-model Context Window and Max Tokens.
- Provider cards and model rows start collapsed.
- Text connectivity probe.
- Vision-path probe.
- Layered diagnostics for DSH image admission, Provider/inference service, and model recognition.
- Native `llm-pi-ai` settings remain the single source of truth.
- API keys never enter the plugin browser UI.

## Install / update

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

Restart the DSH Web Host afterwards and perform one hard browser refresh (Ctrl+F5).

## Usage

Open:

```text
Settings
→ Plugins
→ Model capabilities
```

The page lists configured `llm-pi-ai.providers.*` entries. Each Provider starts collapsed; expand it and then configure models individually.

### Per-model input capability

| UI | Native DSH semantics |
|---|---|
| Inherit DSH default/catalog | clear the model's own `input` |
| Text only | `input: [text]` |
| Text + image | `input: [text, image]` |

The plugin never infers capability from names such as `Qwen-VL` or `Vision`.

### Explicit `models` providers

DSH settings wire paths accept `string[]` only, so array indexes cannot be sent as path segments. For an explicit custom `models` array, the plugin clones the full array, changes only the selected model while preserving unknown fields, and writes the complete `models` value back once:

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

This preserves fields such as `compat`, reasoning metadata, and untouched sibling models.

### Catalog-backed providers

Catalog-backed routes continue to use minimal overrides:

```yaml
llm-pi-ai:
  providers:
    nvidia:
      modelOverrides:
        vision-model:
          input: [text, image]
```

## Provider defaults

The plugin does not expose a Provider-level `defaultInput` editor.

If an older plugin release left:

```yaml
defaultInput: [text, image]
```

the Plugins page shows an explicit cleanup action. It never changes that value silently.

## Text probe

**Test text** sends a minimal request through the current DSH `ctx.llm` route asking the model to return:

```text
MODEL_OK
```

This checks Provider/model routing without exposing credentials to the browser.

## Vision probe

**Test vision**:

1. verifies that DSH currently resolves the model as accepting `image` input;
2. generates a valid PNG probe image at runtime;
3. embeds `VISION_427` in that image;
4. admits the image through the current Harness attachment service;
5. sends it through the configured DSH LLM route;
6. separates DSH, Provider, and recognition-layer failures.

Attachment API compatibility order:

```text
admitPromptContent() → saveImages() → saveImage()
```

CI parses PNG chunks and inflates IDAT data so malformed probe images cannot ship unnoticed.

## Security boundaries

- Never read, store, or display API keys in browser code.
- Never read plaintext `.credentials.yaml`.
- Probes reuse the current DSH Provider / credential path.
- Never silently probe every Provider.
- Never enable multimodal support from model names.
- Never upload arbitrary local user files automatically.
- Capability changes require an explicit save.

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

- the Web bundle registers only `settings.plugins.tab` and never `settings.models.provider-card`;
- collapsed Provider/model UI;
- per-model settings behavior;
- string-only `settings/mutate` paths;
- explicit-model updates preserving unknown fields and siblings;
- valid, decodable vision probe PNG data.

## License

MIT
