# oxlint-better

Oxlint plugins collection for JS/TS projects without AI slop:

- `block-spacing`: Separate statement groups and collapse excess blank lines.
- `pkg-import`: Prefer aliases defined in `package.json#imports` over relative imports.
- `typescript`: Enforce clear types and reject repeated copies of growing reducer accumulators.

## Usage

```sh
npm install --save-dev oxlint oxlint-better
```

`.oxlintrc.json`:

```json
{
  "extends": ["./node_modules/oxlint-better/config.json"]
}
```

Preset enables all rules as errors.

```sh
npx oxlint
```

See the [plugin reference](https://github.com/damianobarbati/oxlint-better/blob/main/docs/plugins.md) for rules and configuration.

## Development

```sh
fnm install --use
npm install -g corepack
corepack enable
pnpm install
pnpm lint
pnpm test
pnpm --filter oxlint-better pack
```

New plugins: register in `packages/oxlint-better/src/index.ts`; add paths to `packages/oxlint-better/package.json#exports`.

## Release

```sh
pnpm release
```

`prepack` builds package automatically.
