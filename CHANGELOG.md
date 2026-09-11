# Changelog

## 0.1.5 - 2026-09-11

- Fix `client api: settings/mutate rejected "ops"` when editing an explicit custom Provider model.
- Align with DSH `SettingsPathOpView`, whose `path` is strictly `string[]`; numeric array indexes are no longer sent over the settings Remote.
- For explicit `providers.<id>.models` arrays, clone the full effective array, modify only the selected row, preserve unknown fields and untouched rows, then `set` the whole `models` array exactly like the native Models editor.
- Keep catalog-backed model edits minimal under `modelOverrides.<modelId>` where every path segment is naturally a string.
- Add a client-bundle regression test that verifies every emitted settings path segment is a string and that explicit-model edits preserve `compat`, reasoning metadata, and sibling rows.

## 0.1.4 - 2026-09-11

- Remove the normal Provider-level `defaultInput` editor. Capability changes are now per-model only.
- Keep both Provider capability panels and individual model rows collapsed by default.
- Detect legacy `defaultInput: [text, image]` values written by earlier releases and offer an explicit one-click cleanup instead of silently mutating user settings.
- Replace the truncated vision-test PNG with a complete 320×96 RGB PNG that visibly contains `VISION_427`.
- Keep attachment compatibility across `admitPromptContent()` → `saveImages()` → `saveImage()`.
- Add a PNG integrity regression test that parses chunks and inflates IDAT data, preventing malformed/truncated fixtures from shipping again.
- Add client-bundle regression checks that reject a Provider-level “save default” control and require per-model-only copy.

## 0.1.3 - 2026-09-11

- Fix the remaining default-expanded behavior in the primary **Settings → Models** integration.
- Collapse the entire `模型能力 · dsh-model-mgr` section by default instead of immediately rendering the full capability model list inside every opened Provider card.
- Keep the existing second disclosure level: after opening the capability section, every individual model row is still collapsed until its own chevron is clicked.
- Use the same collapsed-first behavior in the compatibility **Settings → Plugins → 模型能力** surface.
- Add a regression check that asserts both Provider capability panels and individual model rows start collapsed.

## 0.1.2 - 2026-09-10

- Keep model capability rows collapsed by default, matching the native DeepSeek Harness model-list disclosure behavior.
- Add a compact collapsed summary row showing model identity and stored capability/capacity hints; input mode, capacities, probes, and save actions appear only after expanding that row.
- Keep Provider cards collapsed by default in the compatibility **Settings → Plugins → Model capabilities** entry instead of rendering every Provider body at once.
- Fix vision probing on Harness installations whose attachment provider does not expose the newer `admitPromptContent()` helper.
- Add attachment API compatibility fallback order: `admitPromptContent()` → `saveImages()` → `saveImage()`.
- Classify image-admission/storage failures as a DSH attachment-layer failure instead of incorrectly labeling them as a Provider inference failure.

## 0.1.1 - 2026-09-10

- Fix the Web client activation contract by declaring the `remote.session` runtime dependency used by model-catalog loading.
- Make model-catalog loading non-fatal: explicit `llm-pi-ai.providers.*.models` remain editable even if the catalog Remote is unavailable.
- Rework the client bundle to the same lazy-CJS wrapper shape used by the proven `dsh-subagent-mgr` plugin.
- Keep all `ProviderPanel` React hooks unconditional so settings loading/ready transitions cannot retire the slot entry.
- Add a compatibility UI under **Settings → Plugins → Model capabilities** in addition to the primary `settings.models.provider-card` integration.
- Add a client-bundle smoke test that executes the lazy bundle and verifies both slot registrations.
- Bump the package version so an existing 0.1.0 install can reliably update instead of reusing stale plugin bytes.

## 0.1.0 - 2026-09-10

- Add `settings.models.provider-card` integration for `llm-pi-ai` providers.
- Add Provider `defaultInput` editor.
- Add per-model inherit / text / text+image input capability editor.
- Add `contextWindow` and `maxTokens` editing with nested revision-aware settings patches.
- Add catalog-friendly `modelOverrides` writes.
- Add Host text and fixed-image vision diagnostics using the existing DSH LLM and attachment paths.
- Add layered DSH / Provider / recognition diagnostics.
- Add Chinese default README and English README.
- Add core unit tests and GitHub Actions CI.
