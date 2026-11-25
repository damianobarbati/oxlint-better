import type { ESTree } from '@oxlint/plugins';

import type { TypeAliasEnvironment, TypeBinding, VisitorKeys } from './types.js';

const environmentsByProgram = new WeakMap<ESTree.Program, TypeAliasEnvironment>();

const isNode = (value: unknown): value is ESTree.Node => {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
};

const enclosingTypeScope = (node: ESTree.Node): ESTree.Node => {
  let current: ESTree.Node | null = node.parent;

  while (current !== null) {
    if (
      current.type === 'Program' ||
      current.type === 'BlockStatement' ||
      current.type === 'TSModuleBlock' ||
      current.type === 'StaticBlock' ||
      current.type === 'SwitchStatement'
    ) {
      return current;
    }

    current = current.parent;
  }

  return node;
};

const declaredTypeBinding = (
  node: ESTree.Node,
): {
  alias: ESTree.TSTypeAliasDeclaration | null;
  name: string;
} | null => {
  if (node.type === 'TSTypeAliasDeclaration') {
    return { alias: node, name: node.id.name };
  }

  if (
    node.type === 'TSInterfaceDeclaration' ||
    node.type === 'TSEnumDeclaration' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return node.id === null ? null : { alias: null, name: node.id.name };
  }

  if (
    node.type === 'ImportSpecifier' ||
    node.type === 'ImportDefaultSpecifier' ||
    node.type === 'ImportNamespaceSpecifier'
  ) {
    return { alias: null, name: node.local.name };
  }

  return null;
};

type CollectTypeBindingsInput = {
  node: ESTree.Node;
  visitorKeys: VisitorKeys;
  bindingsByName: Map<string, TypeBinding[]>;
};

const collectTypeBindings = ({
  node,
  visitorKeys,
  bindingsByName,
}: CollectTypeBindingsInput): void => {
  const declared = declaredTypeBinding(node);

  if (declared !== null) {
    const bindings = bindingsByName.get(declared.name) ?? [];
    bindings.push({ alias: declared.alias, scope: enclosingTypeScope(node) });
    bindingsByName.set(declared.name, bindings);
  }

  const unknownNode: unknown = node;

  // JUSTIFICATION: Oxlint's visitor keys identify only ESTree child-node properties.
  const fields = unknownNode as Readonly<Record<string, unknown>>;

  for (const key of visitorKeys[node.type] ?? []) {
    const value = fields[key];

    if (isNode(value)) {
      collectTypeBindings({
        node: value,
        visitorKeys,
        bindingsByName,
      });
      continue;
    }

    if (!Array.isArray(value)) continue;

    for (const child of value) {
      if (isNode(child))
        collectTypeBindings({
          node: child,
          visitorKeys,
          bindingsByName,
        });
    }
  }
};

type CreateTypeAliasEnvironmentInput = {
  program: ESTree.Program;
  visitorKeys: VisitorKeys;
};

export const createTypeAliasEnvironment = ({
  program,
  visitorKeys,
}: CreateTypeAliasEnvironmentInput): TypeAliasEnvironment => {
  const cached = environmentsByProgram.get(program);

  if (cached !== undefined) return cached;
  const bindingsByName = new Map<string, TypeBinding[]>();
  collectTypeBindings({ node: program, visitorKeys, bindingsByName });
  const environment = { bindingsByName, visitorKeys };
  environmentsByProgram.set(program, environment);

  return environment;
};
