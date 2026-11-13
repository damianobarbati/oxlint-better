import type { CreateRule, ESTree, Plugin } from '@oxlint/plugins';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

interface PackageImports {
  directory: string;
  imports: Record<string, unknown>;
}

const packageCache = new Map<string, PackageImports | null>();

const findPackage = ({ filename }: { filename: string }): PackageImports | null => {
  const fileDirectory = dirname(filename);

  if (packageCache.has(fileDirectory)) {
    const cachedPackage = packageCache.get(fileDirectory);

    return cachedPackage ?? null;
  }

  let directory = fileDirectory;

  while (true) {
    const packagePath = resolve(directory, 'package.json');

    if (existsSync(packagePath)) {
      const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
      const currentPackage = { directory, imports: manifest.imports ?? {} };
      packageCache.set(fileDirectory, currentPackage);

      return currentPackage;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      packageCache.set(fileDirectory, null);

      return null;
    }

    directory = parent;
  }
};

const preferPackageImports: CreateRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      preferAlias: 'Use "{{alias}}" from package.json imports.',
    },
  },

  create(context) {
    const currentPackage = findPackage({ filename: context.filename });

    if (!currentPackage) {
      return {};
    }

    const checkSource = (source: ESTree.Expression | null) => {
      if (!source || !('value' in source) || typeof source.value !== 'string') {
        return;
      }

      if (!source.value.startsWith('./') && !source.value.startsWith('../')) {
        return;
      }

      const importedPath = resolve(dirname(context.filename), source.value);

      for (const [alias, target] of Object.entries(currentPackage.imports)) {
        if (typeof target !== 'string' || !target.startsWith('./')) {
          continue;
        }

        if (!alias.endsWith('/*') || !target.endsWith('/*')) {
          continue;
        }

        const targetDirectory = resolve(currentPackage.directory, target.slice(0, -2));
        const prefix = `${targetDirectory}${sep}`;

        if (!importedPath.startsWith(prefix)) {
          continue;
        }

        const suffix = importedPath.slice(prefix.length).split(sep).join('/');
        const replacement = `${alias.slice(0, -1)}${suffix}`;

        context.report({
          node: source,
          messageId: 'preferAlias',
          data: { alias: replacement },
          fix(fixer) {
            const quote = context.sourceCode.getText(source)[0];
            const fix = fixer.replaceText(source, `${quote}${replacement}${quote}`);

            return fix;
          },
        });

        return;
      }
    };

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source);
      },
      ImportExpression(node) {
        checkSource(node.source);
      },
    };
  },
};

const plugin = {
  meta: { name: 'pkg-import' },
  rules: { 'prefer-package-imports': preferPackageImports },
} satisfies Plugin;

export default plugin;
