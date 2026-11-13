import type { ESTree } from '@oxlint/plugins';

import { DICTIONARY_NODE_TYPES } from './types.js';

export const unwrapTransparentType = (type: ESTree.TSType): ESTree.TSType => {
  let current = type;

  while (
    current.type === DICTIONARY_NODE_TYPES.parenthesizedType ||
    (current.type === DICTIONARY_NODE_TYPES.typeOperator &&
      current.operator === DICTIONARY_NODE_TYPES.readonlyOperator)
  ) {
    current = current.typeAnnotation;
  }

  return current;
};
