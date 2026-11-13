import type { ESTree, SourceCode, Variable } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

import { arrayMethodTarget } from '../utils/array-methods/array-method-target.js';
import { isKnownArrayExpression } from '../utils/array-methods/is-known-array-expression.js';
import { resolveArrayBinding } from '../utils/array-methods/resolve-array-binding.js';
import { unwrapArrayExpression } from '../utils/array-methods/unwrap-array-expression.js';

const METHOD_NAMES = {
  reduce: 'reduce',
  reduceRight: 'reduceRight',
  assign: 'assign',
  from: 'from',
  concat: 'concat',
  slice: 'slice',
  toSpliced: 'toSpliced',
  toSorted: 'toSorted',
  toReversed: 'toReversed',
  with: 'with',
} as const;

const REDUCE_METHODS: ReadonlySet<string> = new Set([
  METHOD_NAMES.reduce,
  METHOD_NAMES.reduceRight,
]);

const ARRAY_COPY_METHODS: ReadonlySet<string> = new Set([
  METHOD_NAMES.concat,
  METHOD_NAMES.slice,
  METHOD_NAMES.toSpliced,
  METHOD_NAMES.toSorted,
  METHOD_NAMES.toReversed,
  METHOD_NAMES.with,
]);

const GLOBAL_COPY_OWNERS = {
  object: 'Object',
  array: 'Array',
} as const;

const MESSAGE_IDS = {
  accumulatorCopy: 'accumulatorCopy',
} as const;

const DECLARATION_KINDS = {
  constant: 'const',
} as const;

const enclosingReducer = (node: ESTree.Node) => {
  let callback = node.parent;

  while (
    callback !== null &&
    callback.type !== 'FunctionDeclaration' &&
    callback.type !== 'ArrowFunctionExpression' &&
    callback.type !== 'FunctionExpression'
  ) {
    callback = callback.parent;
  }

  if (callback === null || callback.type === 'FunctionDeclaration') return null;
  let owner: ESTree.Node | null = callback.parent;

  while (owner !== null && unwrapArrayExpression(owner) === callback) owner = owner.parent;

  if (owner?.type !== 'CallExpression') return null;
  const method = arrayMethodTarget(owner.callee);
  const firstArgument = owner.arguments[0];

  if (
    method === null ||
    !REDUCE_METHODS.has(method.name) ||
    owner.arguments.length > 2 ||
    firstArgument === undefined ||
    unwrapArrayExpression(firstArgument) !== callback
  )
    return null;
  const firstParameter = callback.params[0];

  const accumulator =
    firstParameter?.type === 'AssignmentPattern' ? firstParameter.left : firstParameter;

  if (accumulator?.type !== 'Identifier') return null;

  return { callback, accumulator, initialValue: owner.arguments[1] };
};

type ReferencesAccumulatorInput = {
  sourceCode: SourceCode;
  node: ESTree.Node;
  accumulator: Variable;
  visited?: Set<Variable>;
};

const referencesAccumulator = ({
  sourceCode,
  node: inputNode,
  accumulator,
  visited = new Set<Variable>(),
}: ReferencesAccumulatorInput): boolean => {
  const variable = resolveArrayBinding({ sourceCode, node: inputNode });

  if (variable === null || visited.has(variable)) return false;

  if (variable === accumulator) return true;
  visited.add(variable);

  if (variable.references.some((reference) => reference.isWrite() && !reference.init)) return false;

  for (const definition of variable.defs) {
    if (
      definition.type === 'Variable' &&
      definition.node.type === 'VariableDeclarator' &&
      definition.node.id.type === 'Identifier' &&
      definition.node.init !== null &&
      definition.node.parent.type === 'VariableDeclaration' &&
      definition.node.parent.kind === DECLARATION_KINDS.constant
    ) {
      return referencesAccumulator({
        sourceCode,
        node: definition.node.init,
        accumulator,
        visited,
      });
    }
  }

  return false;
};

type IsGlobalCopyOwnerInput = {
  sourceCode: SourceCode;
  node: ESTree.Node;
  name: string;
};

const isGlobalCopyOwner = ({
  sourceCode,
  node: inputNode,
  name,
}: IsGlobalCopyOwnerInput): boolean => {
  const node = unwrapArrayExpression(inputNode);

  if (node.type !== 'Identifier' || node.name !== name) return false;
  const variable = resolveArrayBinding({ sourceCode, node });

  return variable === null || variable.defs.length === 0;
};

type CopiesAccumulatorInput = {
  method: {
    name: string;
    object: ESTree.Node;
  };
  node: ESTree.CallExpression;
  initialValue: ESTree.Node | undefined;
  sourceCode: SourceCode;
  isAccumulator: (expression: ESTree.Node) => boolean;
};

const copiesAccumulator = ({
  method,
  node,
  initialValue,
  sourceCode,
  isAccumulator,
}: CopiesAccumulatorInput): boolean => {
  if (
    method.name === METHOD_NAMES.assign &&
    isGlobalCopyOwner({
      sourceCode,
      node: method.object,
      name: GLOBAL_COPY_OWNERS.object,
    })
  ) {
    const target = node.arguments[0];

    return (
      target !== undefined &&
      unwrapArrayExpression(target).type === 'ObjectExpression' &&
      node.arguments.slice(1).some(isAccumulator)
    );
  }

  if (
    method.name === METHOD_NAMES.from &&
    isGlobalCopyOwner({
      sourceCode,
      node: method.object,
      name: GLOBAL_COPY_OWNERS.array,
    })
  ) {
    const source = node.arguments[0];

    return source !== undefined && isAccumulator(source);
  }

  if (!ARRAY_COPY_METHODS.has(method.name)) {
    return false;
  }

  const arrayAccumulator =
    initialValue !== undefined && isKnownArrayExpression({ sourceCode, node: initialValue });

  return arrayAccumulator && isAccumulator(method.object);
};

export const noReduceAccumulatorCopyRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow copying growing reducer accumulators with Object.assign, Array.from, or array copy methods.',
    },
    messages: {
      [MESSAGE_IDS.accumulatorCopy]:
        'Do not copy the reducer accumulator on every iteration; growing copies can cause quadratic work. Mutate a fresh, locally owned accumulator and return it, or use an iterator pipeline/flatMap.',
    },
  },
  createOnce: (context) => {
    return {
      CallExpression: (node) => {
        const method = arrayMethodTarget(node.callee);

        if (method === null) return;
        const reducer = enclosingReducer(node);

        if (reducer === null) return;

        const accumulator = context.sourceCode
          .getDeclaredVariables(reducer.callback)
          .find((variable) =>
            variable.identifiers.some(
              (identifier) => identifier.start === reducer.accumulator.start,
            ),
          );

        if (accumulator === undefined) return;

        const isAccumulator = (expression: ESTree.Node) =>
          referencesAccumulator({
            sourceCode: context.sourceCode,
            node: expression,
            accumulator,
          });

        if (
          copiesAccumulator({
            method,
            node,
            initialValue: reducer.initialValue,
            sourceCode: context.sourceCode,
            isAccumulator,
          })
        )
          context.report({ node, messageId: MESSAGE_IDS.accumulatorCopy });
      },
    };
  },
});
