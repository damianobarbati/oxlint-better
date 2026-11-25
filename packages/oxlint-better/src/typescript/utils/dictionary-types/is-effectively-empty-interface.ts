import type { ESTree } from '@oxlint/plugins';

import { isEffectivelyEmptyMember } from './is-effectively-empty-member.js';

export const isEffectivelyEmptyInterface = (
  declarations: ESTree.TSInterfaceDeclaration[],
): boolean => {
  if (declarations.length !== 1) return false;
  const [type] = declarations;

  return (
    type !== undefined &&
    type.extends.length === 0 &&
    type.body.body.every(isEffectivelyEmptyMember)
  );
};
