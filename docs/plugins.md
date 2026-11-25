# oxlint-better plugins

## Plugin: block-spacing

- `block-spacing`: Separate declarations from other statements, add spacing around multiline statements, and limit consecutive blank lines to one.

- Keep adjacent single-line declarations grouped; keep adjacent single-line calls grouped.
- Remove blank lines between single-line calls with the same callee, unless separated by comments.
- Remove blank lines between a single-line expression statement and a following single-line non-JSX `return`, unless separated by comments.
- Keep a single-line variable declaration with a following non-JSX `return`, including multiline returns, unless separated by comments.
- Remove blank lines between a single-line `const` declaration and a following single-line `if` whose condition references a variable from that declaration, unless separated by comments.
- Add a blank line before a return of a JSX element or fragment when another statement precedes it in the same block.
- Control statements: `if`, loops, `switch`, `try`.
- Separate preceding statements from control statements on following lines, except for the `const`/`if` case above.
- Autofix: `oxlint --fix`.

```ts
// Before
const ready = check();
prepare();
listen(() => {
  update();
});
if (ready) {
  run();
}

finish();

// After oxlint --fix
const ready = check();

prepare();

listen(() => {
  update();
});

if (ready) {
  run();
}

finish();
```

- Preserve leading comments with following statements.
- Skip preceding blank line for same-line statements and first statement in each block.

## Plugin: pkg-import

- `prefer-package-imports`: Replace relative imports with aliases from the nearest `package.json#imports`.

`package.json`:

```json
{
  "imports": {
    "#root/*": "./src/*"
  }
}
```

`src/features/example.ts`:

```ts
// Before
import { helper } from '../utils/helper.js';

// After oxlint --fix
import { helper } from '#root/utils/helper.js';
```

- Check static imports, re-exports, and dynamic imports with string literals.
- Preserve original quotes.
- Require aliases and targets ending with `/*`; targets must start with `./`.
- Ignore conditional aliases, exact matches, `require()`, and dynamic imports with expressions.
- Use first matching alias in manifest order; do not resolve extensions or `index` files.
- Autofix: `oxlint --fix`.

## Plugin: typescript

- `no-object-parameters`: Require specific parameter types instead of generic `object`.
- `no-reduce-accumulator-copy`: Reject repeated copies of growing reducer accumulators.
- `no-meaningless-unknown-aliases`: Reject type aliases that hide `unknown`.
- `no-unsafe-dictionary-values`: Reject dictionary values typed as `any`, `object`, or `{}`.
- `no-narrowing-after-widening`: Reject widening a known value and then asserting a narrower type.

- Rule prefix: `oxlint-better/`.
- Analysis: syntax and local bindings; no full TypeScript type checking.

## Configuration examples

Override individual rules:

```json
{
  "extends": ["./node_modules/oxlint-better/config.json"],
  "rules": {
    "oxlint-better/no-object-parameters": "off"
  }
}
```

Load only `pkg-import`:

```json
{
  "jsPlugins": [{ "name": "pkg-import", "specifier": "oxlint-better/pkg-import" }],
  "rules": {
    "pkg-import/prefer-package-imports": "warn"
  }
}
```
