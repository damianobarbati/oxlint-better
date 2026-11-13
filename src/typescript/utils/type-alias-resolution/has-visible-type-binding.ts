import type { ESTree } from '@oxlint/plugins';

import { lexicalTypeParameterNames } from '../lexical-type-parameters/lexical-type-parameter-names.js';
import { nearestTypeBindings } from './nearest-type-bindings.js';
import type { TypeAliasEnvironment } from './types.js';

type HasVisibleTypeBindingInput = {
  name: string;
  use: ESTree.Node;
  environment: TypeAliasEnvironment;
};

export const hasVisibleTypeBinding = ({
  name,
  use,
  environment,
}: HasVisibleTypeBindingInput): boolean => {
  return (
    lexicalTypeParameterNames({
      node: use,
      visitorKeys: environment.visitorKeys,
    }).has(name) || nearestTypeBindings({ name, use, environment }).length > 0
  );
};
