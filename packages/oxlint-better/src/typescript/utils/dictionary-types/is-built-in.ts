import type { ESTree } from '@oxlint/plugins';

import { BUILT_INS, type TypeEnvironment } from './types.js';
import { hasVisibleTypeBinding } from '../type-alias-resolution/has-visible-type-binding.js';

type IsBuiltInInput = {
  name: string;
  use: ESTree.Node;
  environment: TypeEnvironment;
};

export const isBuiltIn = ({ name, use, environment }: IsBuiltInInput): boolean => {
  return (
    BUILT_INS.has(name) &&
    !hasVisibleTypeBinding({
      name,
      use,
      environment: environment.typeAliases,
    })
  );
};
