import type { Comment, CreateRule, ESTree, Plugin, Token } from '@oxlint/plugins';

type CheckStatementsInput = { statements: ESTree.Statement[] };
type IsDeclarationInput = { node: ESTree.Node };
type FindExpectationInput = { node: ESTree.Node };

const findExpectation = ({ node }: FindExpectationInput): ESTree.CallExpression | null => {
  let current = node;

  while (current.type === 'CallExpression' || current.type === 'MemberExpression') {
    if (current.type === 'MemberExpression') {
      current = current.object;
      continue;
    }

    if (current.callee.type === 'Identifier' && current.callee.name === 'expect') return current;
    current = current.callee;
  }

  return null;
};

const controlStatements = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
]);

const declarationStatements = new Set([
  'VariableDeclaration',
  'FunctionDeclaration',
  'ClassDeclaration',
  'ImportDeclaration',
  'TSDeclareFunction',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSEnumDeclaration',
  'TSModuleDeclaration',
  'TSGlobalDeclaration',
  'TSImportEqualsDeclaration',
]);

const isDeclaration = ({ node }: IsDeclarationInput): boolean => {
  if (
    (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') &&
    node.declaration !== null
  ) {
    const declaration = isDeclaration({ node: node.declaration });

    return declaration;
  }

  const declaration = declarationStatements.has(node.type);

  return declaration;
};

const blockSpacing: CreateRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: {
      missingBlankLine: 'Add a blank line between these statement groups.',
      extraGroupBlankLine: 'Keep these short statements together.',
      extraBlankLines: 'Use at most one consecutive blank line.',
    },
  },

  create(context) {
    const source = context.sourceCode;
    const newline = source.text.includes('\r\n') ? '\r\n' : '\n';
    const compactGapStarts = new Set<number>();

    const checkStatements = ({ statements }: CheckStatementsInput) => {
      for (let index = 1; index < statements.length; index++) {
        const statement = statements[index];
        const previous = statements[index - 1];

        const declarationBoundary =
          isDeclaration({ node: previous }) !== isDeclaration({ node: statement });
        const multilineBoundary =
          previous.loc.start.line !== previous.loc.end.line ||
          statement.loc.start.line !== statement.loc.end.line;
        const returnBoundary =
          previous.type === 'ExpressionStatement' && statement.type === 'ReturnStatement';
        const guardReturn =
          !multilineBoundary &&
          previous.type === 'IfStatement' &&
          previous.alternate === null &&
          previous.consequent.type === 'ThrowStatement' &&
          statement.type === 'ReturnStatement';
        const declarationReturn =
          previous.type === 'VariableDeclaration' &&
          previous.loc.start.line === previous.loc.end.line &&
          statement.type === 'ReturnStatement';
        const declarationGuard =
          !multilineBoundary &&
          previous.type === 'VariableDeclaration' &&
          previous.kind === 'const' &&
          statement.type === 'IfStatement' &&
          source
            .getDeclaredVariables(previous)
            .some((variable) =>
              variable.references.some(
                ({ identifier }) =>
                  identifier.range[0] >= statement.test.range[0] &&
                  identifier.range[1] <= statement.test.range[1],
              ),
            );
        const expectation =
          statement.type === 'ExpressionStatement'
            ? findExpectation({ node: statement.expression })
            : null;
        const actual = expectation?.arguments[0];
        const declarationExpectation =
          previous.type === 'VariableDeclaration' &&
          previous.loc.start.line === previous.loc.end.line &&
          actual !== undefined &&
          source
            .getDeclaredVariables(previous)
            .some((variable) =>
              variable.references.some(
                ({ identifier }) =>
                  identifier.range[0] >= actual.range[0] && identifier.range[1] <= actual.range[1],
              ),
            );
        const similarCalls =
          previous.type === 'ExpressionStatement' &&
          statement.type === 'ExpressionStatement' &&
          previous.expression.type === 'CallExpression' &&
          statement.expression.type === 'CallExpression' &&
          source.getText(previous.expression.callee) ===
            source.getText(statement.expression.callee);
        const compactBoundary =
          declarationReturn ||
          declarationGuard ||
          guardReturn ||
          declarationExpectation ||
          (!multilineBoundary && (returnBoundary || similarCalls));

        if (compactBoundary && statement.loc.start.line - previous.loc.end.line > 1) {
          const range: [number, number] = [previous.range[1], statement.range[0]];
          const gap = source.text.slice(...range);

          if (/^\s*$/.test(gap)) {
            compactGapStarts.add(range[0]);
            const indentation = gap.slice(gap.lastIndexOf('\n') + 1);
            context.report({
              node: statement,
              messageId: 'extraGroupBlankLine',
              fix(fixer) {
                const fix = fixer.replaceTextRange(range, `${newline}${indentation}`);

                return fix;
              },
            });
          }
        }

        if (
          compactBoundary ||
          (!controlStatements.has(statement.type) && !declarationBoundary && !multilineBoundary)
        ) {
          continue;
        }

        const firstToken = source.getFirstToken(statement);

        if (!firstToken || previous.loc.end.line === firstToken.loc.start.line) {
          continue;
        }

        let first: Token | Comment = firstToken;
        let before = source.getTokenBefore(first, { includeComments: true });

        while (
          before &&
          (before.type === 'Line' || before.type === 'Block') &&
          before.loc.start.line > previous.loc.end.line &&
          first.loc.start.line - before.loc.end.line <= 1
        ) {
          first = before;
          before = source.getTokenBefore(first, { includeComments: true });
        }

        if (!before || first.loc.start.line - before.loc.end.line !== 1) {
          continue;
        }

        const range = before.range;
        context.report({
          node: statement,
          messageId: 'missingBlankLine',
          fix(fixer) {
            const fix = fixer.insertTextAfterRange(range, newline);

            return fix;
          },
        });
      }
    };

    return {
      Program(node) {
        checkStatements({ statements: node.body });
      },
      'Program:exit'(node) {
        const tokens = source.getTokens(node, { includeComments: true });
        let end = 0;

        for (let index = 0; index <= tokens.length; index++) {
          const start = index < tokens.length ? tokens[index].range[0] : source.text.length;
          const gap = source.text.slice(end, start);

          if (!compactGapStarts.has(end) && /^\s*$/.test(gap)) {
            const replacement = gap.replace(
              /(?:\r\n|[\n\r\u2028\u2029])(?:[^\S\r\n\u2028\u2029]*(?:\r\n|[\n\r\u2028\u2029])){2,}/g,
              `${newline}${newline}`,
            );

            if (replacement !== gap) {
              const range: [number, number] = [end, start];
              context.report({
                node,
                loc: { start: source.getLocFromIndex(end), end: source.getLocFromIndex(start) },
                messageId: 'extraBlankLines',
                fix(fixer) {
                  const fix = fixer.replaceTextRange(range, replacement);

                  return fix;
                },
              });
            }
          }

          end = index < tokens.length ? tokens[index].range[1] : start;
        }
      },
      BlockStatement(node) {
        checkStatements({ statements: node.body });
      },
      StaticBlock(node) {
        checkStatements({ statements: node.body });
      },
      SwitchCase(node) {
        checkStatements({ statements: node.consequent });
      },
      TSModuleBlock(node) {
        checkStatements({ statements: node.body });
      },
    };
  },
};

const plugin = {
  meta: { name: 'block-spacing' },
  rules: { 'block-spacing': blockSpacing },
} satisfies Plugin;

export default plugin;
