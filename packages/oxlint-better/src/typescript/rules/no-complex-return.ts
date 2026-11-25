import { defineRule, type ESTree } from '@oxlint/plugins';

const needsExtraction = (node: ESTree.Expression): boolean => {
  if (node.type === 'AwaitExpression' || node.type === 'ChainExpression') {
    return needsExtraction(node.type === 'AwaitExpression' ? node.argument : node.expression);
  }

  if (node.type === 'ObjectExpression') {
    const explicit = node.properties.filter(
      (property) => property.type === 'Property' && !property.shorthand,
    );
    return (
      explicit.length > 1 ||
      node.properties.some(
        (property) => property.type === 'Property' && property.value.type === 'ObjectExpression',
      )
    );
  }

  if (node.type === 'MemberExpression') return needsExtraction(node.object);
  if (node.type !== 'CallExpression') return false;

  return (
    needsExtraction(node.callee) ||
    node.arguments.some(
      (arg) =>
        arg.type === 'ArrowFunctionExpression' ||
        arg.type === 'FunctionExpression' ||
        (arg.type !== 'SpreadElement' && needsExtraction(arg)),
    )
  );
};

export const noComplexReturnRule = defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
    messages: { extract: 'Assign this expression to a local variable before returning it.' },
  },
  createOnce: (context) => ({
    ReturnStatement(node) {
      if (!node.argument || !needsExtraction(node.argument)) return;
      const source = context.sourceCode;
      const block = node.parent;
      const wrapped = block.type !== 'BlockStatement';
      const scope = source.getScope(node);
      const used = new Set([
        ...scope.variables.map((variable) => variable.name),
        ...scope.through.map((reference) => reference.identifier.name),
      ]);
      let name = 'result';

      for (let index = 2; used.has(name); index++) name = 'result' + index;

      const indent = source.lines[node.loc.start.line - 1].match(/^\s*/)?.[0] ?? '';
      const inner = wrapped ? indent + '  ' : indent;
      const original = source.getText(node).slice('return'.length);
      const assignment = 'const ' + name + ' =' + original + (original.endsWith(';') ? '' : ';');
      const statements =
        assignment + '\n' + inner + 'return ' + name + (original.endsWith(';') ? ';' : '');
      context.report({
        node,
        messageId: 'extract',
        fix: (fixer) =>
          fixer.replaceText(
            node,
            wrapped ? '{\n' + inner + statements + '\n' + indent + '}' : statements,
          ),
      });
    },
  }),
});
