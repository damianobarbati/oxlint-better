import type { ESTree } from '@oxlint/plugins';

import { typeReferenceName } from './type-reference-name.js';
import { DICTIONARY_NODE_TYPES } from './types.js';
import { unwrapTransparentType } from './unwrap-transparent-type.js';

type IsUnappliedReferenceToInput = {
  type: ESTree.TSType;
  name: string;
};

export const isUnappliedReferenceTo = ({ type, name }: IsUnappliedReferenceToInput): boolean => {
  const unwrapped = unwrapTransparentType(type);

  return (
    unwrapped.type === DICTIONARY_NODE_TYPES.typeReference &&
    typeReferenceName(unwrapped) === name &&
    (unwrapped.typeArguments === null ||
      unwrapped.typeArguments === undefined ||
      unwrapped.typeArguments.params.length === 0)
  );
};
