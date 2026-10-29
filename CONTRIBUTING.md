# Contributing

Contributions that make simulation assumptions clearer and experiments easier to reproduce are especially useful. This project models token accounting; please keep proposed integrations and runtime features distinct from implemented behavior.

## Local development

Use Node 22.12+ and pnpm 10.18.3. Fork/clone the repository and follow [README quick start](README.md#quick-start).

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
pnpm test
pnpm build
node scripts/reproduce-example.mjs --check
```

No API credentials are needed. Do not include private prompts, credentials or proprietary tool schemas in examples or bug reports. Use synthetic, minimal configurations.

## Report a bug or propose a change

Open an issue in [this repository](https://github.com/zhangHongEn/token-lab/issues). Include:

- What you expected and what happened, with exact UI steps or commands.
- A minimal exported JSON configuration, commit/release identifier, Node/browser version and language setting.
- The relevant round/request and units for any accounting discrepancy; source links and verification date for a pricing correction.

For a feature proposal, describe the developer task, a concrete example, how success could be checked and which current assumptions would change. Do not describe planned features as already available.

## Pull requests

1. Use a focused branch and change. Explain the problem and resulting behavior.
2. For engine changes, add a regression case covering the incorrect accounting behavior. Check caching after compression, final-turn compression, units, disabled/triggered steps and global overrides when relevant.
3. Run tests and production build. If formulas or results change, regenerate the example, inspect its diff and explain why results changed. Never edit generated totals by hand.
4. For UI changes, check English/Chinese, narrow screens, keyboard navigation, empty/invalid settings and pending calculations. Include screenshots when helpful.
5. Update affected docs and report the checks actually run, along with known limits.

There is no separate lint script in the current package. The existing CI runs tests and build on pull requests. Keep the lockfile when changing dependencies.

## Templates and pricing

Built-in templates are v4 JSON discovered recursively from `src/config/default-template/` in filename order. The first becomes the starting configuration. Validate via the project's config reader and existing template tests; use stable IDs, allowed plan colors, supported flow fields and explicit inheritance. Do not imply a modeled “hosted tool search” node calls a real service.

For new pricing data, include official URL, retrieval date, currency/unit, region and tier/time conditions. Document missing cache writes/storage/tool fees. Preserve existing IDs where possible because configs may refer to them. If a rate cannot be verified, use a clearly labeled custom example instead of claiming a current official price.

## Documentation and licensing

Use English for primary documentation; update the Chinese guide when behavior changes. Separate measured observations, deterministic simulations and conceptual illustrations. Do not promise savings or quality parity. Contributions are made under the repository's [MIT license](LICENSE).
