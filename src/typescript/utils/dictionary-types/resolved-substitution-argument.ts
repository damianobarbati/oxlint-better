import type { ESTree } from '@oxlint/plugins';

import { typeReferenceName } from './type-reference-name.js';
import { DICTIONARY_NODE_TYPES } from './types.js';
import { unwrapTransparentType } from './unwrap-transparent-type.js';

type ResolvedSubstitutionArgumentInput = {
  type: ESTree.TSType;
  base: ReadonlyMap<string, ESTree.TSType>;
  resolving?: ReadonlySet<string>;
};

export const resolvedSubstitutionArgument = ({
  type,
  base,
  resolving = new Set(),
}: ResolvedSubstitutionArgumentInput): ESTree.TSType => {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type !== DICTIONARY_NODE_TYPES.typeReference) return type;
  const name = typeReferenceName(unwrapped);

  if (name === null || resolving.has(name)) return type;
  const substitution = base.get(name);

  if (substitution === undefined) return type;
  const nextResolving = new Set(resolving);
  nextResolving.add(name);

  return resolvedSubstitutionArgument({
    type: substitution,
    base,
    resolving: nextResolving,
  });
};
