import type { Plugin } from '@oxlint/plugins';
import blockSpacing from './block-spacing.js';
import pkgImport from './pkg-import.js';
import typescript from './typescript.js';

export { pkgImport, typescript, blockSpacing };

const plugin = {
  meta: { name: 'oxlint-better' },
  rules: {
    ...blockSpacing.rules,
    ...pkgImport.rules,
    ...typescript.rules,
  },
} satisfies Plugin;

export default plugin;
