import type { ESTree } from '@oxlint/plugins';

import type { FunctionParameter } from './types.js';

export const functionParameterTypeAnnotation = (
  parameter: FunctionParameter,
): ESTree.TSTypeAnnotation | null | undefined => {
  if (parameter.type === 'TSParameterProperty') {
    return functionParameterTypeAnnotation(parameter.parameter);
  }

  if (parameter.type === 'RestElement') {
    return parameter.typeAnnotation ?? functionParameterTypeAnnotation(parameter.argument);
  }

  if (parameter.type === 'AssignmentPattern') {
    return parameter.typeAnnotation ?? functionParameterTypeAnnotation(parameter.left);
  }

  return parameter.typeAnnotation;
};
