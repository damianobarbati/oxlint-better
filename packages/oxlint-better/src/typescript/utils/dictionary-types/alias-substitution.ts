import type { ESTree } from '@oxlint/plugins';

import { resolvedSubstitutionArgument } from './resolved-substitution-argument.js';
import type { DictionaryTypeSubstitutions } from './types.js';

type AliasSubstitutionInput = {
  alias: ESTree.TSTypeAliasDeclaration;
  type: ESTree.TSTypeReference;
  base: DictionaryTypeSubstitutions;
};

export const aliasSubstitution = ({
  alias,
  type,
  base,
}: AliasSubstitutionInput): DictionaryTypeSubstitutions | null => {
  const parameters = alias.typeParameters?.params ?? [];
  const typeArguments = type.typeArguments?.params ?? [];
  const next = new Map(base);

  for (const [index, parameter] of parameters.entries()) {
    const argument = typeArguments[index] ?? parameter.default;

    if (argument === null || argument === undefined) return null;
    next.set(parameter.name.name, resolvedSubstitutionArgument({ type: argument, base: next }));
  }

  return next;
};
