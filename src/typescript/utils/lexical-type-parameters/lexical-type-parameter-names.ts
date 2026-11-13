import type { ESTree } from '@oxlint/plugins';

type VisitorKeys = Readonly<Record<string, ReadonlyArray<string>>>;

const isNode = (value: unknown): value is ESTree.Node => {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
};

const hasTypeParameters = (
  node: ESTree.Node,
): node is Extract<ESTree.Node, { typeParameters: unknown }> => 'typeParameters' in node;

type CollectInferTypeParameterNamesInput = {
  node: ESTree.Node;
  visitorKeys: VisitorKeys;
  names: Set<string>;
};

const collectInferTypeParameterNames = ({
  node,
  visitorKeys,
  names,
}: CollectInferTypeParameterNamesInput): void => {
  if (node.type === 'TSInferType') names.add(node.typeParameter.name.name);
  const unknownNode: unknown = node;

  // JUSTIFICATION: Oxlint's visitor keys identify only ESTree child-node properties.
  const record = unknownNode as Readonly<Record<string, unknown>>;

  for (const key of visitorKeys[node.type] ?? []) {
    const value = record[key];

    if (isNode(value)) {
      collectInferTypeParameterNames({ node: value, visitorKeys, names });
      continue;
    }

    if (!Array.isArray(value)) continue;

    for (const child of value) {
      if (isNode(child)) collectInferTypeParameterNames({ node: child, visitorKeys, names });
    }
  }
};

type LexicalTypeParameterNamesInput = {
  node: ESTree.Node;
  visitorKeys: VisitorKeys;
};

export const lexicalTypeParameterNames = ({
  node,
  visitorKeys,
}: LexicalTypeParameterNamesInput): ReadonlySet<string> => {
  const names = new Set<string>();
  let descendant: ESTree.Node = node;
  let current: ESTree.Node | null = node;

  while (current !== null && current.type !== 'Program') {
    if (hasTypeParameters(current)) {
      for (const parameter of current.typeParameters?.params ?? []) {
        names.add(parameter.name.name);
      }
    }

    if (
      current.type === 'TSMappedType' &&
      (descendant === current.nameType || descendant === current.typeAnnotation)
    ) {
      names.add(current.key.name);
    }

    if (current.type === 'TSConditionalType' && descendant === current.trueType) {
      collectInferTypeParameterNames({
        node: current.extendsType,
        visitorKeys,
        names,
      });
    }

    descendant = current;
    current = current.parent;
  }

  return names;
};
