import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import plugin, * as exports from 'oxlint-better';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'node_modules/oxlint/bin/oxlint');

const cases = [
  {
    rule: 'block-spacing',
    invalid: 'prepare();\nif (ready) {}',
    valid: 'prepare();\n\nif (ready) {}',
  },
  {
    rule: 'prefer-package-imports',
    invalid: "import './src/helper.js';",
    valid: "import '#src/helper.js';",
  },
  {
    rule: 'no-object-parameters',
    invalid: 'export const save = (value: object) => value;',
    valid: 'type Input = { id: string }; export const save = (value: Input) => value;',
  },
  {
    rule: 'no-reduce-accumulator-copy',
    invalid: 'export const items = [1, 2].reduce<number[]>((acc, item) => acc.concat(item), []);',
    valid:
      'export const items = [1, 2].reduce<number[]>((acc, item) => { acc.push(item); return acc; }, []);',
  },
  {
    rule: 'no-meaningless-unknown-aliases',
    invalid: 'export type Payload = unknown;',
    valid: 'export const parse = (value: unknown) => value;',
  },
  {
    rule: 'no-unsafe-dictionary-values',
    invalid: 'export type Settings = Record<string, any>;',
    valid: 'export type Settings = Record<string, unknown>;',
  },
  {
    rule: 'no-narrowing-after-widening',
    invalid:
      'const original = { id: "1" }; const value: unknown = original; export const user = value as { id: string };',
    valid: 'export const user = { id: "1" } satisfies { id: string };',
  },
];

const regressionCases = [
  {
    rule: 'no-object-parameters',
    name: 'resolves generic object aliases and respects type parameter shadowing',
    invalid:
      'type Identity<T> = T; type Input = Identity<object>; export const save = (value: Input) => value;',
    valid: 'type Input = object; export const save = <Input>(value: Input) => value;',
  },
  {
    rule: 'no-meaningless-unknown-aliases',
    name: 'resolves unknown aliases and respects nested type parameters',
    invalid: 'type Identity<T> = T; export type Payload = Identity<unknown>;',
    valid:
      'export const parse = <Payload>(value: Payload) => { type Input = Payload; const input: Input = value; return input; };',
  },
  {
    rule: 'no-unsafe-dictionary-values',
    name: 'checks aliased dictionary values and respects shadowed utility types',
    invalid: 'type Value = any; export type Settings = Record<string, Value>;',
    valid: 'type Record<K, V> = { key: K; value: V }; export type Settings = Record<string, any>;',
  },
  {
    rule: 'no-reduce-accumulator-copy',
    name: 'rejects array copies without rejecting string concatenation',
    invalid:
      'export const items = [1, 2].reduce<number[]>((acc, item) => { const copy = acc.slice(); copy.push(item); return copy; }, []);',
    valid: "export const text = ['a', 'b'].reduce((acc, item) => acc.concat(item), '');",
  },
  {
    rule: 'no-narrowing-after-widening',
    name: 'tracks known local types without rejecting external unknown input',
    invalid:
      'type User = { id: string }; const original: User = { id: "1" }; const widened: unknown = original; export const user = widened as User;',
    valid: 'type User = { id: string }; export const parse = (value: unknown) => value as User;',
  },
];

test('exports the typescript group without the old antiSlop export', () => {
  assert.equal(exports.typescript.meta.name, 'typescript');
  assert.equal('antiSlop' in exports, false);

  for (const { rule } of cases.filter((entry) => entry.rule.startsWith('no-'))) {
    assert.equal(plugin.rules[rule], exports.typescript.rules[rule]);
  }
});

test('exports only the selected rules', () => {
  assert.deepEqual(Object.keys(plugin.rules).toSorted(), cases.map(({ rule }) => rule).toSorted());
});

test('published preset loads all rules and supports consumer overrides', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'oxlint-better-preset-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const pack = spawnSync(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  assert.equal(pack.status, 0, pack.error?.message ?? pack.stdout + pack.stderr);
  const [archive] = JSON.parse(pack.stdout);
  assert.equal(
    archive.files.some(({ path }) => /anti-slop|vendor/.test(path)),
    false,
  );
  const packageDirectory = join(directory, 'node_modules/oxlint-better');
  mkdirSync(packageDirectory, { recursive: true });
  const unpack = spawnSync(
    'tar',
    ['-xzf', join(directory, archive.filename), '-C', packageDirectory, '--strip-components=1'],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(unpack.status, 0, unpack.error?.message ?? unpack.stdout + unpack.stderr);
  mkdirSync(join(directory, 'node_modules/@oxlint'), { recursive: true });
  symlinkSync(
    join(root, 'node_modules/@oxlint/plugins'),
    join(directory, 'node_modules/@oxlint/plugins'),
    'dir',
  );

  assert.match(readFileSync(join(packageDirectory, 'dist/typescript.js'), 'utf8'), /MIT License/);
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ imports: { '#src/*': './src/*' } }),
  );
  const configPath = join(directory, '.oxlintrc.json');
  const inputPath = join(directory, 'input.ts');
  const config = {
    extends: ['./node_modules/oxlint-better/config.json'],
    categories: { correctness: 'off', suspicious: 'off' },
  };
  writeFileSync(configPath, JSON.stringify(config));

  await t.test('consumer needs only extends', () => {
    writeFileSync(configPath, JSON.stringify({ extends: config.extends }));
    writeFileSync(inputPath, 'export const save = (value: object) => value;');
    const result = spawnSync(
      process.execPath,
      [cli, '-c', configPath, '--format', 'json', inputPath],
      {
        cwd: directory,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 1, result.error?.message ?? result.stdout + result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.diagnostics.length, 1, result.stdout);
    assert.match(output.diagnostics[0].code, /oxlint-better.*no-object-parameters/);
    writeFileSync(configPath, JSON.stringify(config));
  });

  for (const { rule, invalid, valid, name } of [...cases, ...regressionCases]) {
    await t.test(name ?? `${rule} rejects violations and accepts valid input`, () => {
      writeFileSync(inputPath, invalid);
      const failure = spawnSync(
        process.execPath,
        [cli, '-c', configPath, '--format', 'json', inputPath],
        {
          cwd: directory,
          encoding: 'utf8',
        },
      );
      assert.equal(failure.status, 1, failure.error?.message ?? failure.stdout + failure.stderr);
      const output = JSON.parse(failure.stdout);
      assert.equal(output.diagnostics.length, 1, failure.stdout);
      assert.match(output.diagnostics[0].code, new RegExp(`oxlint-better.*${rule}`));
      assert.equal(output.diagnostics[0].severity, 'error');

      writeFileSync(inputPath, valid);
      const success = spawnSync(
        process.execPath,
        [cli, '-c', configPath, '--format', 'json', inputPath],
        {
          cwd: directory,
          encoding: 'utf8',
        },
      );
      assert.equal(success.status, 0, success.error?.message ?? success.stdout + success.stderr);
      assert.deepEqual(JSON.parse(success.stdout).diagnostics, []);
    });
  }

  await t.test('consumer can disable a preset rule', () => {
    writeFileSync(
      configPath,
      JSON.stringify({ ...config, rules: { 'oxlint-better/no-object-parameters': 'off' } }),
    );
    writeFileSync(inputPath, 'export const save = (value: object) => value;');
    const result = spawnSync(
      process.execPath,
      [cli, '-c', configPath, '--format', 'json', inputPath],
      {
        cwd: directory,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).diagnostics, []);
  });

  await t.test('preset fixes package imports', () => {
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(inputPath, "import './src/helper.js';");
    const result = spawnSync(process.execPath, [cli, '-c', configPath, '--fix', inputPath], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
    assert.equal(readFileSync(inputPath, 'utf8'), "import '#src/helper.js';");
  });
});
