import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import plugin, { pkgImport } from 'oxlint-better';
import individualPlugin from 'oxlint-better/pkg-import';

const cli = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url));

test('exports the aggregate and individual plugin', () => {
  assert.equal(pkgImport, individualPlugin);
  assert.equal(plugin.rules['prefer-package-imports'], pkgImport.rules['prefer-package-imports']);
});

for (const entry of ['index', 'pkg-import']) {
  test(`${entry}: Oxlint fixes imports and re-exports using the nearest manifest`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'oxlint-better-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const src = join(directory, 'src');
    mkdirSync(join(src, 'nested'), { recursive: true });
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        imports: { '#src/*': './src/*' },
      }),
    );
    writeFileSync(
      join(src, 'nested', 'package.json'),
      JSON.stringify({
        imports: { '#nested/*': './*' },
      }),
    );
    const input = [
      "import './utils/a.js';",
      'export { b } from "./utils/b.js";',
      "export * from './utils/c.js';",
      "void import('./utils/d.js');",
      "import '#src/already.js';",
      "import 'external';",
      "import '../outside.js';",
      'void import(`./utils/${name}.js`);',
    ].join('\n');
    writeFileSync(join(src, 'example.ts'), input);
    writeFileSync(join(src, 'nested', 'example.ts'), "import './helper.js';\n");
    const config = join(directory, '.oxlintrc.json');
    writeFileSync(
      config,
      JSON.stringify({
        categories: { correctness: 'off' },
        jsPlugins: [
          {
            name: 'better',
            specifier: fileURLToPath(new URL(`../dist/${entry}.js`, import.meta.url)),
          },
        ],
        rules: { 'better/prefer-package-imports': 'error' },
      }),
    );
    const result = spawnSync(process.execPath, [cli, '-c', config, '--fix', src], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
    const expected = input
      .replaceAll('./utils/', '#src/utils/')
      .replace('`#src/utils/${name}.js`', '`./utils/${name}.js`');
    assert.equal(readFileSync(join(src, 'example.ts'), 'utf8'), expected);
    assert.equal(
      readFileSync(join(src, 'nested', 'example.ts'), 'utf8'),
      "import '#nested/helper.js';\n",
    );
  });
}
