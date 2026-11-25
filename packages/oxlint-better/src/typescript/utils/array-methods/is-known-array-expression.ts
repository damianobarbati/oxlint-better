import type { ESTree, SourceCode, Variable } from '@oxlint/plugins';

import { arrayMethodTarget } from './array-method-target.js';
import { resolveArrayBinding } from './resolve-array-binding.js';
import { unwrapArrayExpression } from './unwrap-array-expression.js';

const TYPE_NAMES = {
  array: 'Array',
  readonlyArray: 'ReadonlyArray',
  readonlyOperator: 'readonly',
} as const;

const ARRAY_METHOD_NAMES = {
  map: 'map',
  filter: 'filter',
  flatMap: 'flatMap',
  slice: 'slice',
  concat: 'concat',
  toSorted: 'toSorted',
  toReversed: 'toReversed',
  toSpliced: 'toSpliced',
} as const;

const ARRAY_METHODS: ReadonlySet<string> = new Set(Object.values(ARRAY_METHOD_NAMES));

const DECLARATION_KINDS = {
  constant: 'const',
} as const;

const isArrayAnnotation = (type: ESTree.TSType): boolean => {
  if (type.type === 'TSArrayType' || type.type === 'TSTupleType') return true;

  if (type.type === 'TSParenthesizedType') return isArrayAnnotation(type.typeAnnotation);

  if (type.type === 'TSTypeOperator' && type.operator === TYPE_NAMES.readonlyOperator) {
    return isArrayAnnotation(type.typeAnnotation);
  }

  return (
    type.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    (type.typeName.name === TYPE_NAMES.array || type.typeName.name === TYPE_NAMES.readonlyArray)
  );
};

type IsKnownArrayExpressionInput = {
  sourceCode: SourceCode;
  node: ESTree.Node;
  visited?: Set<Variable>;
};

export const isKnownArrayExpression = ({
  sourceCode,
  node: inputNode,
  visited = new Set<Variable>(),
}: IsKnownArrayExpressionInput): boolean => {
  const node = unwrapArrayExpression(inputNode);

  if (node.type === 'ArrayExpression') return true;

  if (node.type === 'CallExpression') {
    const method = arrayMethodTarget(node.callee);

    return (
      method !== null &&
      ARRAY_METHODS.has(method.name) &&
      isKnownArrayExpression({
        sourceCode,
        node: method.object,
        visited,
      })
    );
  }

  if (node.type !== 'Identifier') return false;
  const variable = resolveArrayBinding({ sourceCode, node });

  if (variable === null || visited.has(variable)) return false;
  visited.add(variable);

  if (variable.references.some((reference) => reference.isWrite() && !reference.init)) return false;

  for (const identifier of variable.identifiers) {
    const annotation = identifier.typeAnnotation?.typeAnnotation;

    if (annotation !== undefined) return isArrayAnnotation(annotation);
  }

  for (const definition of variable.defs) {
    if (
      definition.type === 'Variable' &&
      definition.node.type === 'VariableDeclarator' &&
      definition.node.id.type === 'Identifier' &&
      definition.node.init !== null &&
      definition.node.parent.type === 'VariableDeclaration' &&
      definition.node.parent.kind === DECLARATION_KINDS.constant
    ) {
      return isKnownArrayExpression({
        sourceCode,
        node: definition.node.init,
        visited,
      });
    }
  }

  return false;
};
