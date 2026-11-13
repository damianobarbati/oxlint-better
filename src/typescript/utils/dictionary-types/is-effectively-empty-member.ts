import type { ESTree } from '@oxlint/plugins';

import { DICTIONARY_NODE_TYPES } from './types.js';
import { unwrapTransparentType } from './unwrap-transparent-type.js';

export const isEffectivelyEmptyMember = (member: ESTree.TSSignature): boolean => {
  if (
    member.type !== DICTIONARY_NODE_TYPES.propertySignature ||
    member.optional !== true ||
    member.typeAnnotation === null ||
    member.typeAnnotation === undefined
  ) {
    return false;
  }

  const valueType = unwrapTransparentType(member.typeAnnotation.typeAnnotation);

  return valueType.type === DICTIONARY_NODE_TYPES.neverKeyword;
};
