import type { ESTree } from '@oxlint/plugins';

export const unwrapArrayExpression = (node: ESTree.Node): ESTree.Node => {
  while (
    node.type === 'ParenthesizedExpression' ||
    node.type === 'ChainExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSSatisfiesExpression'
  ) {
    node = node.expression;
  }

  return node;
};
