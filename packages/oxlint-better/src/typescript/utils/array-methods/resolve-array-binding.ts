import type { ESTree, SourceCode, Variable } from '@oxlint/plugins';

import { unwrapArrayExpression } from './unwrap-array-expression.js';
import { resolveVariable } from '../scope/resolve-variable.js';

type ResolveArrayBindingInput = {
  sourceCode: SourceCode;
  node: ESTree.Node;
};

export const resolveArrayBinding = ({
  sourceCode,
  node: inputNode,
}: ResolveArrayBindingInput): Variable | null => {
  const node = unwrapArrayExpression(inputNode);

  if (node.type !== 'Identifier') return null;

  return resolveVariable({ sourceCode, identifier: node });
};
