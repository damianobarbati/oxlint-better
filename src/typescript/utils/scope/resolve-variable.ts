import type { ESTree, Scope, SourceCode, Variable } from '@oxlint/plugins';

type ResolveVariableInput = {
  sourceCode: SourceCode;
  identifier: ESTree.Node & { name: string };
};

export const resolveVariable = ({
  sourceCode,
  identifier,
}: ResolveVariableInput): Variable | null => {
  let scope: Scope | null = sourceCode.getScope(identifier);

  while (scope !== null) {
    const variable = scope.set.get(identifier.name);

    if (variable !== undefined) return variable;
    scope = scope.upper;
  }

  return null;
};
