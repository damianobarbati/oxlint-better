import type { ESTree } from '@oxlint/plugins';

import { unwrapArrayExpression } from './unwrap-array-expression.js';

type StringLiteral = ESTree.StringLiteral;

const isStringLiteral = (node: ESTree.Node): node is StringLiteral => {
  return node.type === 'Literal' && typeof node.value === 'string';
};

export const arrayMethodTarget = (
  node: ESTree.Node,
): { name: string; object: ESTree.Node } | null => {
  node = unwrapArrayExpression(node);

  if (node.type !== 'MemberExpression') return null;
  const property = node.property;

  if (!node.computed && property.type === 'Identifier') {
    return { name: property.name, object: node.object };
  }

  if (node.computed && isStringLiteral(property)) {
    return { name: property.value, object: node.object };
  }

  return null;
};
