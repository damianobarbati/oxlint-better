import type { ESTree } from '@oxlint/plugins';

import { aliasSubstitution } from './alias-substitution.js';
import { isBuiltIn } from './is-built-in.js';
import { isUnappliedReferenceTo } from './is-unapplied-reference-to.js';
import { typeReferenceName } from './type-reference-name.js';
import {
  BUILT_IN_TYPE_NAMES,
  DICTIONARY_NODE_TYPES,
  type DictionaryResolvedType,
  type DictionaryTypeSubstitutions,
  TRANSPARENT_WRAPPERS,
  type TypeEnvironment,
} from './types.js';
import { unwrapTransparentType } from './unwrap-transparent-type.js';
import { visibleTypeAlias } from '../type-alias-resolution/visible-type-alias.js';

type DictionaryValueTypesInput = {
  type: ESTree.TSType;
  environment: TypeEnvironment;
  substitutions: DictionaryTypeSubstitutions;
  resolvingAliases: ReadonlySet<string>;
};

export const dictionaryValueTypes = ({
  type,
  environment,
  substitutions,
  resolvingAliases,
}: DictionaryValueTypesInput): DictionaryResolvedType[] => {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === DICTIONARY_NODE_TYPES.typeLiteral) {
    return unwrapped.members.flatMap((member): DictionaryResolvedType[] =>
      member.type === DICTIONARY_NODE_TYPES.indexSignature && member.typeAnnotation !== null
        ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
        : [],
    );
  }

  if (unwrapped.type === DICTIONARY_NODE_TYPES.mappedType) {
    return unwrapped.typeAnnotation === null
      ? []
      : [{ type: unwrapped.typeAnnotation, substitutions }];
  }

  if (unwrapped.type !== DICTIONARY_NODE_TYPES.typeReference) return [];
  const name = typeReferenceName(unwrapped);

  if (name === null) return [];

  const substitution = substitutions.get(name);

  if (substitution !== undefined) {
    return isUnappliedReferenceTo({ type: substitution, name })
      ? []
      : dictionaryValueTypes({
          type: substitution,
          environment,
          substitutions,
          resolvingAliases,
        });
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn({ name, use: unwrapped, environment })) {
    const wrapped = unwrapped.typeArguments?.params[0];

    return wrapped === undefined
      ? []
      : dictionaryValueTypes({
          type: wrapped,
          environment,
          substitutions,
          resolvingAliases,
        });
  }

  if (name === BUILT_IN_TYPE_NAMES.record && isBuiltIn({ name, use: unwrapped, environment })) {
    const value = unwrapped.typeArguments?.params[1] ?? null;

    return value === null ? [] : [{ type: value, substitutions }];
  }

  if (
    (name === BUILT_IN_TYPE_NAMES.pick || name === BUILT_IN_TYPE_NAMES.omit) &&
    isBuiltIn({ name, use: unwrapped, environment })
  ) {
    const source = unwrapped.typeArguments?.params[0];

    return source === undefined
      ? []
      : dictionaryValueTypes({
          type: source,
          environment,
          substitutions,
          resolvingAliases,
        });
  }

  const alias = visibleTypeAlias({
    name,
    use: unwrapped,
    environment: environment.typeAliases,
  });

  if (alias === null || resolvingAliases.has(name)) return [];

  const nextSubstitutions = aliasSubstitution({
    alias,
    type: unwrapped,
    base: substitutions,
  });

  if (nextSubstitutions === null) return [];
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);

  return dictionaryValueTypes({
    type: alias.typeAnnotation,
    environment,
    substitutions: nextSubstitutions,
    resolvingAliases: nextResolving,
  });
};
