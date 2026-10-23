import assert from 'node:assert/strict';
import test from 'node:test';
import { orderDeclarations, orderImports, styleFile } from '../../scripts/code-style.mjs';

test('orders declarations by group, then alphabetically', () => {
  const css = '.a {\n  color: red;\n  width: 1px;\n  display: grid;\n  position: relative;\n}';
  assert.equal(
    orderDeclarations(css),
    '.a {\n  position: relative;\n  display: grid;\n  width: 1px;\n  color: red;\n}',
  );
});

test('never moves a longhand in front of the shorthand that overrides it', () => {
  const css = '.a {\n  padding-top: 1px;\n  padding: 0;\n  color: red;\n  display: block;\n}';
  assert.equal(
    orderDeclarations(css),
    '.a {\n  display: block;\n  padding-top: 1px;\n  padding: 0;\n  color: red;\n}',
  );
  const sides = '.a {\n  top: 0;\n  inset: 1px;\n}';
  assert.equal(orderDeclarations(sides), sides);
});

test('places a vendor-prefixed property just before its standard form', () => {
  const css = '.a {\n  box-decoration-break: clone;\n  -webkit-box-decoration-break: clone;\n}';
  assert.equal(
    orderDeclarations(css),
    '.a {\n  -webkit-box-decoration-break: clone;\n  box-decoration-break: clone;\n}',
  );
});

test('groups imports and keeps stylesheet order', () => {
  const code = [
    "import { profile } from '../data/profile';",
    "import Header from '../components/Header.astro';",
    "import '../styles/b.css';",
    "import '../styles/a.css';",
    "import { routes } from '../data/navigation';",
    "import { Image } from 'astro:assets';",
    'const x = 1;',
    '',
  ].join('\n');
  assert.equal(
    orderImports(code),
    [
      "import { Image } from 'astro:assets';",
      "import '../styles/b.css';",
      "import '../styles/a.css';",
      "import Header from '../components/Header.astro';",
      "import { routes } from '../data/navigation';",
      "import { profile } from '../data/profile';",
      '',
      'const x = 1;',
      '',
    ].join('\n'),
  );
});

test('separates markup from the component stylesheet with one blank line', () => {
  const astro = '---\n---\n\n<p>Text</p>\n<style>\n  p {\n    margin: 0;\n  }\n</style>\n';
  assert.equal(
    styleFile('Example.astro', astro),
    '---\n---\n\n<p>Text</p>\n\n<style>\n  p {\n    margin: 0;\n  }\n</style>\n',
  );
});

test('puts Node built-ins before packages and local imports in scripts', () => {
  const code = "import z from 'zod';\nimport fs from 'node:fs';\nimport a from './a.mjs';\n";
  const expected = "import fs from 'node:fs';\nimport z from 'zod';\nimport a from './a.mjs';\n";
  assert.equal(orderImports(code), expected);
  assert.equal(styleFile('check.mjs', code), expected);
  assert.equal(
    styleFile('check.mjs', `// Check content.\n${code}`),
    `// Check content.\n${expected}`,
  );
});

test('preserves intersecting border side and color, width or style shorthands', () => {
  const pairs = [
    ...['top', 'right', 'bottom', 'left'].flatMap((side) =>
      ['color: blue', 'width: 2px', 'style: solid'].map((part) => [
        `border-${side}: 0;`,
        `border-${part};`,
      ]),
    ),
  ];
  for (const pair of pairs) {
    for (const declarations of [pair, [...pair].reverse()]) {
      const css = `.a {\n  ${declarations.join('\n  ')}\n}`;
      assert.equal(orderDeclarations(css), css);
    }
  }
});

test('preserves the line height reset by a later font shorthand', () => {
  const css = '.a {\n  line-height: 2;\n  font: 16px Georgia;\n}';
  assert.equal(orderDeclarations(css), css);
});
