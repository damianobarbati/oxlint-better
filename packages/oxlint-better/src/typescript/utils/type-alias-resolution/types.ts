import type { ESTree } from '@oxlint/plugins';

export type VisitorKeys = Readonly<Record<string, ReadonlyArray<string>>>;

export type TypeBinding = {
  alias: ESTree.TSTypeAliasDeclaration | null;
  scope: ESTree.Node;
};

export type TypeAliasEnvironment = {
  bindingsByName: ReadonlyMap<string, TypeBinding[]>;
  visitorKeys: VisitorKeys;
};

export type ResolvedTypeMatcherInput = {
  type: ESTree.TSType;
  matches: (child: ESTree.TSType) => boolean;
};

export type ResolvedTypeMatcher = ({ type, matches }: ResolvedTypeMatcherInput) => boolean;
