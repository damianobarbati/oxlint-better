import type { ESTree } from '@oxlint/plugins';

import { DICTIONARY_NODE_TYPES } from './types.js';

export const typeReferenceName = (type: ESTree.TSTypeReference): string | null => {
  return type.typeName.type === DICTIONARY_NODE_TYPES.identifier ? type.typeName.name : null;
};
