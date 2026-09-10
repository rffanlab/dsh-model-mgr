# Changelog

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
