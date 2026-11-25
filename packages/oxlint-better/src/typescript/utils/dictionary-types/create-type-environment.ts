import type { ESTree } from '@oxlint/plugins';

import type { TypeEnvironment } from './types.js';
import { createTypeAliasEnvironment } from '../type-alias-resolution/create-type-alias-environment.js';

const declaredStatement = (statement: ESTree.Statement): ESTree.Node | null => {
  return statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
    ? (statement.declaration ?? null)
    : statement;
};

type CreateTypeEnvironmentInput = {
  program: ESTree.Program;
  visitorKeys: Readonly<Record<string, ReadonlyArray<string>>>;
};

export const createTypeEnvironment = ({
  program,
  visitorKeys,
}: CreateTypeEnvironmentInput): TypeEnvironment => {
  const interfaces = new Map<string, ESTree.TSInterfaceDeclaration[]>();

  for (const statement of program.body) {
    const declaration = declaredStatement(statement);

    if (declaration?.type !== 'TSInterfaceDeclaration') continue;
    const declarations = interfaces.get(declaration.id.name) ?? [];
    declarations.push(declaration);
    interfaces.set(declaration.id.name, declarations);
  }

  return {
    interfaces,
    typeAliases: createTypeAliasEnvironment({ program, visitorKeys }),
  };
};
