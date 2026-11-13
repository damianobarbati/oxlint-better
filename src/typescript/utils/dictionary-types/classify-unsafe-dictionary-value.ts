import type { ESTree } from '@oxlint/plugins';

import { classifyUnsafeType } from './classify-unsafe-type.js';
import {
  type TypeEnvironment,
  UNSAFE_DICTIONARY_VALUES,
  type UnsafeDictionaryOptions,
  type UnsafeDictionaryValue,
} from './types.js';

type ClassifyUnsafeDictionaryValueInput = {
  valueType: ESTree.TSType;
  environment: TypeEnvironment;
  options?: UnsafeDictionaryOptions;
};

export const classifyUnsafeDictionaryValue = ({
  valueType,
  environment,
  options = { allowUnknown: false },
}: ClassifyUnsafeDictionaryValueInput): UnsafeDictionaryValue | null => {
  const unsafeValue = classifyUnsafeType({
    type: valueType,
    environment,
    substitutions: new Map(),
    resolvingAliases: new Set(),
    options,
  });

  if (
    unsafeValue === null ||
    (options.allowUnknown && unsafeValue === UNSAFE_DICTIONARY_VALUES.unknown)
  ) {
    return null;
  }

  return unsafeValue;
};
