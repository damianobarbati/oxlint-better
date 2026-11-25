import type { SourceCode } from '@oxlint/plugins';

import type { FunctionParameter } from './types.js';

type FunctionParameterBindingNameInput = {
  parameter: FunctionParameter;
  sourceCode: SourceCode;
};

export const functionParameterBindingName = ({
  parameter,
  sourceCode,
}: FunctionParameterBindingNameInput): string => {
  if (parameter.type === 'TSParameterProperty') {
    return functionParameterBindingName({
      parameter: parameter.parameter,
      sourceCode,
    });
  }

  if (parameter.type === 'AssignmentPattern') {
    return functionParameterBindingName({
      parameter: parameter.left,
      sourceCode,
    });
  }

  if (parameter.type === 'RestElement') {
    return functionParameterBindingName({
      parameter: parameter.argument,
      sourceCode,
    });
  }

  if (parameter.type === 'Identifier') return parameter.name;

  const sourceText = sourceCode.getText(parameter);
  const annotationStart = parameter.typeAnnotation?.start;

  return annotationStart === undefined
    ? sourceText
    : sourceText.slice(0, annotationStart - parameter.start).trimEnd();
};
