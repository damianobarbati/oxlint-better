import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

import { createTypeAliasEnvironment } from '../utils/type-alias-resolution/create-type-alias-environment.js';
import { resolvedTypeMatches } from '../utils/type-alias-resolution/resolved-type-matches.js';
import type { TypeAliasEnvironment } from '../utils/type-alias-resolution/types.js';

const MESSAGE_IDS = {
  unknownAlias: 'unknownAlias',
} as const;

export const noMeaninglessUnknownAliasesRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow type aliases whose resolved type is unknown; unknown must remain visible at an allowed boundary.',
    },
    messages: {
      [MESSAGE_IDS.unknownAlias]:
        'Type alias `{{alias}}` resolves to `unknown`. Keep `unknown` visible, or define a type that describes the value instead of hiding it behind an alias.',
    },
  },
  createOnce: (context) => {
    let environment: TypeAliasEnvironment | null = null;

    const resolvesToUnknown = (type: ESTree.TSType): boolean =>
      environment !== null &&
      resolvedTypeMatches({
        type,
        environment,
        matcher: ({ type: resolved, matches }) => {
          if (resolved.type === 'TSUnknownKeyword') return true;

          if (resolved.type === 'TSParenthesizedType') {
            return matches(resolved.typeAnnotation);
          }

          return resolved.type === 'TSUnionType' && resolved.types.some(matches);
        },
      });

    return {
      Program: (node) => {
        environment = createTypeAliasEnvironment({
          program: node,
          visitorKeys: context.sourceCode.visitorKeys,
        });
      },
      TSTypeAliasDeclaration: (node) => {
        if (!resolvesToUnknown(node.typeAnnotation)) return;
        context.report({
          node: node.id,
          messageId: MESSAGE_IDS.unknownAlias,
          data: { alias: node.id.name },
        });
      },
    };
  },
});
