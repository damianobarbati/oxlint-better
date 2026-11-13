import type { ESTree } from '@oxlint/plugins';

import { classifyUnsafeType } from './classify-unsafe-type.js';
import { dictionaryValueTypes } from './dictionary-value-types.js';
import {
  type TypeEnvironment,
  UNSAFE_DICTIONARY_VALUES,
  type UnsafeDictionaryOptions,
  type UnsafeDictionaryValue,
} from './types.js';

type ClassifyUnsafeDictionaryInput = {
  type: ESTree.TSType;
  environment: TypeEnvironment;
  options?: UnsafeDictionaryOptions;
};

export const classifyUnsafeDictionary = ({
  type,
  environment,
  options = { allowUnknown: false },
}: ClassifyUnsafeDictionaryInput): UnsafeDictionaryValue | null => {
  const valueTypes = dictionaryValueTypes({
    type,
    environment,
    substitutions: new Map(),
    resolvingAliases: new Set(),
  });

  for (const valueType of valueTypes) {
    const unsafeValue = classifyUnsafeType({
      type: valueType.type,
      environment,
      substitutions: valueType.substitutions,
      resolvingAliases: new Set(),
      options,
    });

    if (
      unsafeValue === null ||
      (options.allowUnknown && unsafeValue === UNSAFE_DICTIONARY_VALUES.unknown)
    ) {
      continue;
    }

    return unsafeValue;
  }

  return null;
};
