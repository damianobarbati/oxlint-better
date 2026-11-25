import type { ESTree } from '@oxlint/plugins';

import { lexicalTypeParameterNames } from '../lexical-type-parameters/lexical-type-parameter-names.js';
import { nearestTypeBindings } from './nearest-type-bindings.js';
import type { TypeAliasEnvironment } from './types.js';

type VisibleTypeAliasInput = {
  name: string;
  use: ESTree.Node;
  environment: TypeAliasEnvironment;
};

export const visibleTypeAlias = ({
  name,
  use,
  environment,
}: VisibleTypeAliasInput): ESTree.TSTypeAliasDeclaration | null => {
  const typeParameters = lexicalTypeParameterNames({
    node: use,
    visitorKeys: environment.visitorKeys,
  });

  if (typeParameters.has(name)) {
    return null;
  }

  const bindings = nearestTypeBindings({ name, use, environment });

  if (bindings.length !== 1) {
    return null;
  }

  return bindings[0].alias;
};
