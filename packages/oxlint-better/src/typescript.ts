/*
MIT License

Copyright (c) 2026 Emilio Spatola

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import type { Plugin } from '@oxlint/plugins';
import { noComplexReturnRule } from './typescript/rules/no-complex-return.js';
import { noObjectParametersRule } from './typescript/rules/no-object-parameters.js';
import { noReduceAccumulatorCopyRule } from './typescript/rules/no-reduce-accumulator-copy.js';
import { noMeaninglessUnknownAliasesRule } from './typescript/rules/no-meaningless-unknown-aliases.js';
import { noUnsafeDictionaryValuesRule } from './typescript/rules/no-unsafe-dictionary-values.js';
import { noNarrowingAfterWideningRule } from './typescript/rules/no-narrowing-after-widening.js';

const plugin = {
  meta: { name: 'typescript' },
  rules: {
    'no-complex-return': noComplexReturnRule,
    'no-object-parameters': noObjectParametersRule,
    'no-reduce-accumulator-copy': noReduceAccumulatorCopyRule,
    'no-meaningless-unknown-aliases': noMeaninglessUnknownAliasesRule,
    'no-unsafe-dictionary-values': noUnsafeDictionaryValuesRule,
    'no-narrowing-after-widening': noNarrowingAfterWideningRule,
  },
} satisfies Plugin;

export default plugin;
