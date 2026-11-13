import type { ESTree } from '@oxlint/plugins';

import { isEffectivelyEmptyMember } from './is-effectively-empty-member.js';

export const isEffectivelyEmptyTypeLiteral = (type: ESTree.TSTypeLiteral): boolean => {
  return type.members.every(isEffectivelyEmptyMember);
};
