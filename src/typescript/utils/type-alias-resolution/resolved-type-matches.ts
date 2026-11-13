import type { ESTree } from '@oxlint/plugins';

import { typeReferenceName } from '../dictionary-types/type-reference-name.js';
import type { ResolvedTypeMatcher, TypeAliasEnvironment } from './types.js';
import { visibleTypeAlias } from './visible-type-alias.js';

type Substitution = {
  substitutions: Substitutions;
  type: ESTree.TSType;
};

type Substitutions = ReadonlyMap<string, Substitution>;

type AliasSubstitutionsInput = {
  alias: ESTree.TSTypeAliasDeclaration;
  reference: ESTree.TSTypeReference;
  base: Substitutions;
};

const aliasSubstitutions = ({
  alias,
  reference,
  base,
}: AliasSubstitutionsInput): Substitutions | null => {
  const parameters = alias.typeParameters?.params ?? [];
  const typeArguments = reference.typeArguments?.params ?? [];
  const next = new Map(base);

  for (const [index, parameter] of parameters.entries()) {
    const explicitArgument = typeArguments[index];
    const argument = explicitArgument ?? parameter.default;

    if (argument === null || argument === undefined) return null;
    const argumentSubstitutions = explicitArgument === undefined ? next : base;
    next.set(parameter.name.name, {
      type: argument,
      substitutions: new Map(argumentSubstitutions),
    });
  }

  return next;
};

type EvaluateInput = {
  current: ESTree.TSType;
  substitutions: Substitutions;
  resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>;
};

type ResolvedTypeMatchesInput = {
  type: ESTree.TSType;
  environment: TypeAliasEnvironment;
  matcher: ResolvedTypeMatcher;
};

export const resolvedTypeMatches = ({
  type,
  environment,
  matcher,
}: ResolvedTypeMatchesInput): boolean => {
  const evaluate = ({ current, substitutions, resolvingAliases }: EvaluateInput): boolean => {
    if (current.type === 'TSTypeReference') {
      const name = typeReferenceName(current);

      if (name !== null) {
        const substitution = substitutions.get(name);

        if (substitution !== undefined && !current.typeArguments?.params.length) {
          return evaluate({
            current: substitution.type,
            substitutions: substitution.substitutions,
            resolvingAliases,
          });
        }

        const alias = visibleTypeAlias({
          name,
          use: current,
          environment,
        });

        if (alias !== null && !resolvingAliases.has(alias)) {
          const nextSubstitutions = aliasSubstitutions({
            alias,
            reference: current,
            base: substitutions,
          });

          if (nextSubstitutions !== null) {
            const nextResolving = new Set(resolvingAliases);
            nextResolving.add(alias);

            return evaluate({
              current: alias.typeAnnotation,
              substitutions: nextSubstitutions,
              resolvingAliases: nextResolving,
            });
          }
        }
      }
    }

    return matcher({
      type: current,
      matches: (child) =>
        evaluate({
          current: child,
          substitutions,
          resolvingAliases,
        }),
    });
  };

  return evaluate({
    current: type,
    substitutions: new Map(),
    resolvingAliases: new Set(),
  });
};
