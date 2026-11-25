import type { ESTree, Variable } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

import { typeReferenceName } from '../utils/dictionary-types/type-reference-name.js';

const BROAD_TYPE_KINDS = {
  top: 'top',
  object: 'object',
  record: 'record',
} as const;

type BroadTypeKind = (typeof BROAD_TYPE_KINDS)[keyof typeof BROAD_TYPE_KINDS];

type KnownValueEvidence = {
  type: ESTree.TSType | null;
};

const MESSAGE_IDS = {
  widenThenAssert: 'widenThenAssert',
} as const;

const DECLARATION_KINDS = {
  constant: 'const',
} as const;

const FUNCTION_BOUNDARY_TYPES: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
]);

const unwrapExpressionParentheses = (expression: ESTree.Expression): ESTree.Expression => {
  let current = expression;

  while (current.type === 'ParenthesizedExpression') current = current.expression;

  return current;
};

const unwrapTypeParentheses = (type: ESTree.TSType): ESTree.TSType => {
  let current = type;

  while (current.type === 'TSParenthesizedType') current = current.typeAnnotation;

  return current;
};

const isUnknownOrAnyType = (type: ESTree.TSType): boolean => {
  const unwrapped = unwrapTypeParentheses(type);

  return unwrapped.type === 'TSUnknownKeyword' || unwrapped.type === 'TSAnyKeyword';
};

const isBroadRecordKeyType = (type: ESTree.TSType): boolean => {
  const unwrapped = unwrapTypeParentheses(type);

  if (
    unwrapped.type === 'TSStringKeyword' ||
    unwrapped.type === 'TSNumberKeyword' ||
    unwrapped.type === 'TSSymbolKeyword'
  ) {
    return true;
  }

  if (unwrapped.type === 'TSUnionType') return unwrapped.types.every(isBroadRecordKeyType);

  return unwrapped.type === 'TSTypeReference' && typeReferenceName(unwrapped) === 'PropertyKey';
};

const isBroadRecordType = (type: ESTree.TSType): boolean => {
  const unwrapped = unwrapTypeParentheses(type);

  if (unwrapped.type === 'TSTypeReference') {
    if (typeReferenceName(unwrapped) === 'Readonly') {
      const [inner] = unwrapped.typeArguments?.params ?? [];

      return inner !== undefined && isBroadRecordType(inner);
    }

    if (typeReferenceName(unwrapped) !== 'Record') return false;
    const parameters = unwrapped.typeArguments?.params ?? [];

    return (
      parameters.length === 2 &&
      parameters[0] !== undefined &&
      parameters[1] !== undefined &&
      isBroadRecordKeyType(parameters[0]) &&
      isUnknownOrAnyType(parameters[1])
    );
  }

  if (unwrapped.type !== 'TSTypeLiteral' || unwrapped.members.length !== 1) return false;
  const [member] = unwrapped.members;

  if (member?.type !== 'TSIndexSignature' || member.parameters.length !== 1) return false;

  const [parameter] = member.parameters;

  return (
    parameter !== undefined &&
    isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation) &&
    isUnknownOrAnyType(member.typeAnnotation.typeAnnotation)
  );
};

const broadTypeKind = (type: ESTree.TSType): BroadTypeKind | null => {
  const unwrapped = unwrapTypeParentheses(type);

  if (unwrapped.type === 'TSUnknownKeyword' || unwrapped.type === 'TSAnyKeyword')
    return BROAD_TYPE_KINDS.top;

  if (unwrapped.type === 'TSObjectKeyword') return BROAD_TYPE_KINDS.object;

  return isBroadRecordType(unwrapped) ? BROAD_TYPE_KINDS.record : null;
};

const assertedExpression = (
  node: ESTree.TSAsExpression | ESTree.TSTypeAssertion,
): ESTree.Expression => {
  return unwrapExpressionParentheses(node.expression);
};

const assertionFromExpression = (
  expression: ESTree.Expression,
): ESTree.TSAsExpression | ESTree.TSTypeAssertion | null => {
  const unwrapped = unwrapExpressionParentheses(expression);

  return unwrapped.type === 'TSAsExpression' || unwrapped.type === 'TSTypeAssertion'
    ? unwrapped
    : null;
};

type NormalizedTypeTextInput = {
  sourceText: string;
  type: ESTree.TSType;
};

const normalizedTypeText = ({ sourceText, type }: NormalizedTypeTextInput): string => {
  return sourceText.slice(type.start, type.end).replaceAll(/\s+/gu, '');
};

type TypesHaveSameSyntaxInput = {
  sourceText: string;
  left: ESTree.TSType | null;
  right: ESTree.TSType;
};

const typesHaveSameSyntax = ({ sourceText, left, right }: TypesHaveSameSyntaxInput): boolean => {
  return (
    left !== null &&
    normalizedTypeText({
      sourceText,
      type: unwrapTypeParentheses(left),
    }) ===
      normalizedTypeText({
        sourceText,
        type: unwrapTypeParentheses(right),
      })
  );
};

const isDefinitelyObjectType = (type: ESTree.TSType): boolean => {
  const unwrapped = unwrapTypeParentheses(type);

  switch (unwrapped.type) {
    case 'TSArrayType':
    case 'TSConstructorType':
    case 'TSFunctionType':
    case 'TSMappedType':
    case 'TSObjectKeyword':
    case 'TSTupleType':
      return true;
    case 'TSTypeLiteral':
      return unwrapped.members.length > 0;
    case 'TSIntersectionType':
      return unwrapped.types.every(isDefinitelyObjectType);
    case 'TSTypeOperator':
      return unwrapped.operator === 'readonly' && isDefinitelyObjectType(unwrapped.typeAnnotation);
    default:
      return false;
  }
};

const isDefinitelyNarrowerRecordType = (type: ESTree.TSType): boolean => {
  const unwrapped = unwrapTypeParentheses(type);

  if (unwrapped.type === 'TSTypeLiteral') {
    return unwrapped.members.some((member) => member.type !== 'TSIndexSignature');
  }

  if (unwrapped.type !== 'TSTypeReference') return false;

  if (typeReferenceName(unwrapped) === 'Readonly') {
    const [inner] = unwrapped.typeArguments?.params ?? [];

    return inner !== undefined && isDefinitelyNarrowerRecordType(inner);
  }

  if (typeReferenceName(unwrapped) !== 'Record') return false;

  const parameters = unwrapped.typeArguments?.params ?? [];

  return (
    parameters.length === 2 && parameters[1] !== undefined && !isUnknownOrAnyType(parameters[1])
  );
};

const functionBoundary = (node: ESTree.Node): ESTree.Node | null => {
  let current = node.parent;

  while (current !== null && current.type !== 'Program') {
    if (FUNCTION_BOUNDARY_TYPES.has(current.type)) return current;
    current = current.parent;
  }

  return null;
};

type Scope = {
  references: {
    identifier: ESTree.Node;
    resolved: Variable | null;
  }[];
};

type ResolvedVariableForIdentifierInput = {
  scopes: Scope[];
  identifier: ESTree.IdentifierReference;
};

const resolvedVariableForIdentifier = ({
  scopes,
  identifier,
}: ResolvedVariableForIdentifierInput): Variable | null => {
  for (const scope of scopes) {
    const reference = scope.references.find(
      (candidate) =>
        candidate.identifier.start === identifier.start &&
        candidate.identifier.end === identifier.end,
    );

    if (reference !== undefined) return reference.resolved;
  }

  return null;
};

const variableDeclarator = (variable: Variable): ESTree.VariableDeclarator | null => {
  for (const definition of variable.defs) {
    if (definition.type === 'Variable' && definition.node.type === 'VariableDeclarator') {
      return definition.node;
    }
  }

  return null;
};

type KnownValueEvidenceForAnnotationInput = {
  variable: Variable;
  boundary: ESTree.Node | null;
};

const knownValueEvidenceForAnnotation = ({
  variable,
  boundary,
}: KnownValueEvidenceForAnnotationInput): KnownValueEvidence | null | undefined => {
  const annotatedIdentifier = variable.identifiers.find(
    (identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
  );

  const annotation = annotatedIdentifier?.typeAnnotation?.typeAnnotation;

  if (annotation === undefined || annotatedIdentifier === undefined) return undefined;

  if (functionBoundary(annotatedIdentifier) !== boundary || broadTypeKind(annotation) !== null)
    return null;

  return { type: annotation };
};

type KnownValueEvidenceForIdentifierInput = {
  expression: ESTree.IdentifierReference;
  scopes: Scope[];
  boundary: ESTree.Node | null;
  visitedVariables: ReadonlySet<Variable>;
};

const knownValueEvidenceForIdentifier = ({
  expression,
  scopes,
  boundary,
  visitedVariables,
}: KnownValueEvidenceForIdentifierInput): KnownValueEvidence | null => {
  const variable = resolvedVariableForIdentifier({
    scopes,
    identifier: expression,
  });

  if (variable === null || visitedVariables.has(variable)) return null;

  const annotationEvidence = knownValueEvidenceForAnnotation({
    variable,
    boundary,
  });

  if (annotationEvidence !== undefined) return annotationEvidence;

  const declarator = variableDeclarator(variable);

  if (
    declarator === null ||
    declarator.parent.type !== 'VariableDeclaration' ||
    declarator.parent.kind !== DECLARATION_KINDS.constant ||
    declarator.init === null ||
    variable.references.some((reference) => reference.isWrite() && !reference.init) ||
    functionBoundary(declarator) !== boundary
  ) {
    return null;
  }

  return knownValueEvidence({
    expression: declarator.init,
    scopes,
    boundary,
    visitedVariables: new Set([...visitedVariables, variable]),
  });
};

type KnownValueEvidenceInput = {
  expression: ESTree.Expression;
  scopes: Scope[];
  boundary: ESTree.Node | null;
  visitedVariables: ReadonlySet<Variable>;
};

const knownValueEvidence = ({
  expression,
  scopes,
  boundary,
  visitedVariables,
}: KnownValueEvidenceInput): KnownValueEvidence | null => {
  const unwrapped = unwrapExpressionParentheses(expression);

  if (unwrapped.type === 'TSAsExpression' || unwrapped.type === 'TSTypeAssertion') {
    if (broadTypeKind(unwrapped.typeAnnotation) !== null) return null;

    return { type: unwrapped.typeAnnotation };
  }

  if (unwrapped.type === 'Literal' || unwrapped.type === 'TemplateLiteral') {
    return { type: null };
  }

  if (
    unwrapped.type === 'ArrayExpression' ||
    unwrapped.type === 'ArrowFunctionExpression' ||
    unwrapped.type === 'ClassExpression' ||
    unwrapped.type === 'FunctionExpression' ||
    unwrapped.type === 'NewExpression' ||
    unwrapped.type === 'ObjectExpression'
  ) {
    return { type: null };
  }

  if (unwrapped.type !== 'Identifier') return null;

  return knownValueEvidenceForIdentifier({
    expression: unwrapped,
    scopes,
    boundary,
    visitedVariables,
  });
};

type WidenedBinding = {
  broadKind: BroadTypeKind;
  evidence: KnownValueEvidence;
  declaredAt: number;
  boundary: ESTree.Node | null;
};

type StableConstantDeclaratorInput = {
  variable: Variable;
};

const stableConstantDeclarator = ({
  variable,
}: StableConstantDeclaratorInput): ESTree.VariableDeclarator | null => {
  const declarator = variableDeclarator(variable);

  if (
    declarator === null ||
    declarator.parent.type !== 'VariableDeclaration' ||
    declarator.parent.kind !== DECLARATION_KINDS.constant ||
    declarator.id.type !== 'Identifier' ||
    declarator.init === null ||
    variable.references.some((reference) => reference.isWrite() && !reference.init)
  )
    return null;

  return declarator;
};

type WidenedBindingInput = {
  variable: Variable;
  scopes: Scope[];
};

const widenedBinding = ({ variable, scopes }: WidenedBindingInput): WidenedBinding | null => {
  const declarator = stableConstantDeclarator({ variable });

  if (declarator === null) return null;

  const initializer = declarator.init;

  if (initializer === null) return null;

  const initializerAssertion = assertionFromExpression(initializer);

  const initializerBroadKind =
    initializerAssertion === null ? null : broadTypeKind(initializerAssertion.typeAnnotation);

  const declaredType = declarator.id.typeAnnotation?.typeAnnotation;
  const declaredBroadKind = declaredType === undefined ? null : broadTypeKind(declaredType);

  const broadKind = declaredBroadKind ?? initializerBroadKind;

  if (broadKind === null) return null;

  const originalExpression =
    initializerAssertion !== null && initializerBroadKind !== null
      ? assertedExpression(initializerAssertion)
      : initializer;

  const boundary = functionBoundary(declarator);

  const evidence = knownValueEvidence({
    expression: originalExpression,
    scopes,
    boundary,
    visitedVariables: new Set([variable]),
  });

  return evidence === null ? null : { broadKind, evidence, declaredAt: declarator.end, boundary };
};

type AssertionIsNarrowerInput = {
  sourceText: string;
  broadKind: BroadTypeKind;
  evidence: KnownValueEvidence;
  assertedType: ESTree.TSType;
};

const assertionIsNarrower = ({
  sourceText,
  broadKind,
  evidence,
  assertedType,
}: AssertionIsNarrowerInput): boolean => {
  if (broadTypeKind(assertedType) !== null) return false;

  if (broadKind === BROAD_TYPE_KINDS.top) return true;

  if (
    typesHaveSameSyntax({
      sourceText,
      left: evidence.type,
      right: assertedType,
    })
  )
    return true;

  if (broadKind === BROAD_TYPE_KINDS.object) return isDefinitelyObjectType(assertedType);

  return isDefinitelyNarrowerRecordType(assertedType);
};

export const noNarrowingAfterWideningRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow local const flows that explicitly widen a known value before asserting the widened binding to a narrower type.',
    },
    messages: {
      [MESSAGE_IDS.widenThenAssert]:
        'Value "{{name}}" is given a broad type and later converted with a type assertion. Keep its original type, or validate external input with a named type guard before using it.',
    },
  },
  createOnce: (context) => {
    let scopes: Scope[] = [];

    const checkAssertion = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion) => {
      const expression = assertedExpression(node);

      if (expression.type !== 'Identifier') return;

      const variable = resolvedVariableForIdentifier({
        scopes,
        identifier: expression,
      });

      if (variable === null) return;
      const widened = widenedBinding({ variable, scopes });

      if (
        widened === null ||
        node.start <= widened.declaredAt ||
        functionBoundary(node) !== widened.boundary ||
        !assertionIsNarrower({
          sourceText: context.sourceCode.text,
          broadKind: widened.broadKind,
          evidence: widened.evidence,
          assertedType: node.typeAnnotation,
        })
      ) {
        return;
      }

      context.report({
        node,
        messageId: MESSAGE_IDS.widenThenAssert,
        data: { name: expression.name },
      });
    };

    return {
      Program: () => {
        scopes = context.sourceCode.scopeManager.scopes;
      },
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
