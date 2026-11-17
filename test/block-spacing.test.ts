import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import plugin, { blockSpacing } from 'oxlint-better';

const executeFile = promisify(execFile);

const cli = fileURLToPath(new URL('../node_modules/oxlint/bin/oxlint', import.meta.url));

const scenarios = [
  {
    name: 'keeps the deadline declaration with its abort check',
    input: `async function validateCodexModel({ model, signal }) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);

  deadline.throwIfAborted();

  const child = spawn('codex', ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'] });
}`,
    expected: `async function validateCodexModel({ model, signal }) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  deadline.throwIfAborted();

  const child = spawn('codex', ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'] });
}`,
  },
  {
    name: 'groups consecutive methods with their variable declaration',
    input:
      'const client = createClient();\n\nclient.connect();\n\nawait client.send(data);\n\nclient.close();',
    expected:
      'const client = createClient();\nclient.connect();\nawait client.send(data);\nclient.close();',
  },
  {
    name: 'accepts compact declarations and method calls',
    input: 'let client = createClient();\nclient.connect();\nclient.close();',
    expected: 'let client = createClient();\nclient.connect();\nclient.close();',
  },
  {
    name: 'groups multiline declarations and methods',
    input:
      'const client = createClient({\n  timeout: 1000,\n});\n\nclient.send(\n  data,\n);\n\nclient.close();',
    expected:
      'const client = createClient({\n  timeout: 1000,\n});\nclient.send(\n  data,\n);\nclient.close();',
  },
  {
    name: 'groups destructured bindings with optional computed and chained methods',
    input:
      'const { client } = services;\n\nclient?.connect();\n\nclient[method](data);\n\nclient.configure().send(data);',
    expected:
      'const { client } = services;\nclient?.connect();\nclient[method](data);\nclient.configure().send(data);',
  },
  {
    name: 'separates methods of another variable and calls with the variable as argument',
    input:
      'const client = createClient();\nother.connect(client);\nconst request = createRequest();\nclient.send(request);',
    expected:
      'const client = createClient();\n\nother.connect(client);\n\nconst request = createRequest();\n\nclient.send(request);',
  },
  {
    name: 'does not treat a method name as a reference to the declaration',
    input: 'const connect = createClient();\nclient.connect();',
    expected: 'const connect = createClient();\n\nclient.connect();',
  },
  {
    name: 'ends method groups at unrelated statements',
    input: 'const client = createClient();\nclient.connect();\nlog();\n\nclient.close();',
    expected: 'const client = createClient();\nclient.connect();\nlog();\n\nclient.close();',
  },
  {
    name: 'preserves comments before related methods',
    input: 'const client = createClient();\n\n// Connect client\nclient.connect();',
    expected: 'const client = createClient();\n\n// Connect client\nclient.connect();',
  },
  {
    name: 'keeps declaration methods compact with CRLF',
    input: 'const client = createClient();\r\n\r\n\r\nclient.connect();\r\n\r\nclient.close();',
    expected: 'const client = createClient();\r\nclient.connect();\r\nclient.close();',
  },
  {
    name: 'keeps response and repository declarations with their expectations',
    input: `async function run() {
  expect(created.status).toEqual(200);

  const user = await created.json();

  expect(user).toEqual({ id: expect.any(Number), name: input.name, email: input.email });

  const row = await UserRepository.get(user.id, true);

  expect(row.password_hash).toEqual(createHash('sha256').update(password).digest('hex'));
  expect(row).not.toHaveProperty('password');
}`,
    expected: `async function run() {
  expect(created.status).toEqual(200);

  const user = await created.json();
  expect(user).toEqual({ id: expect.any(Number), name: input.name, email: input.email });

  const row = await UserRepository.get(user.id, true);
  expect(row.password_hash).toEqual(createHash('sha256').update(password).digest('hex'));
  expect(row).not.toHaveProperty('password');
}`,
  },
  {
    name: 'accepts a compact declaration and negated expectation',
    input: 'const row = getRow();\nexpect(row).not.toHaveProperty("password");',
    expected: 'const row = getRow();\nexpect(row).not.toHaveProperty("password");',
  },
  {
    name: 'keeps a declaration with its multiline expectation',
    input: 'const user = getUser();\n\nexpect(user).toEqual({\n  name: input.name,\n});',
    expected: 'const user = getUser();\nexpect(user).toEqual({\n  name: input.name,\n});',
  },
  {
    name: 'separates expectations of a different variable',
    input: 'const user = getUser();\nexpect(other).toEqual(user);',
    expected: 'const user = getUser();\n\nexpect(other).toEqual(user);',
  },
  {
    name: 'does not treat an expected property name as a variable reference',
    input: 'const user = getUser();\nexpect(result.user).toEqual(input);',
    expected: 'const user = getUser();\n\nexpect(result.user).toEqual(input);',
  },
  {
    name: 'preserves comments before expectations',
    input: 'const user = getUser();\n\n// Check response\nexpect(user).toEqual(input);',
    expected: 'const user = getUser();\n\n// Check response\nexpect(user).toEqual(input);',
  },
  {
    name: 'keeps multiline declarations separate from expectations',
    input: 'const user = getUser(\n  input,\n);\nexpect(user).toEqual(input);',
    expected: 'const user = getUser(\n  input,\n);\n\nexpect(user).toEqual(input);',
  },
  {
    name: 'keeps declaration expectations compact with CRLF',
    input: 'const user = getUser();\r\n\r\n\r\nexpect(user).toEqual(input);',
    expected: 'const user = getUser();\r\nexpect(user).toEqual(input);',
  },
  {
    name: 'keeps the authorization declaration with its single-line guard',
    input: `const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization');

  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};`,
    expected: `const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};`,
  },
  {
    name: 'accepts a compact declaration and guard',
    input: 'const token = getToken();\nif (!token) return;',
    expected: 'const token = getToken();\nif (!token) return;',
  },
  {
    name: 'keeps a destructured declaration with its guard',
    input: 'const { token } = request;\n\nif (!token) return;',
    expected: 'const { token } = request;\nif (!token) return;',
  },
  {
    name: 'separates a guard that checks a different variable',
    input: 'const token = getToken();\nif (!ready) return;',
    expected: 'const token = getToken();\n\nif (!ready) return;',
  },
  {
    name: 'does not treat a property name as a reference to the declaration',
    input: 'const token = getToken();\nif (!request.token) return;',
    expected: 'const token = getToken();\n\nif (!request.token) return;',
  },
  {
    name: 'separates a multiline guard from its declaration',
    input: 'const token = getToken();\nif (!token) {\n  return;\n}',
    expected: 'const token = getToken();\n\nif (!token) {\n  return;\n}',
  },
  {
    name: 'separates a multiline declaration from its guard',
    input: 'const token = getToken(\n  request,\n);\nif (!token) return;',
    expected: 'const token = getToken(\n  request,\n);\n\nif (!token) return;',
  },
  {
    name: 'preserves comments before a related guard',
    input: 'const token = getToken();\n\n// Check authorization\nif (!token) return;',
    expected: 'const token = getToken();\n\n// Check authorization\nif (!token) return;',
  },
  {
    name: 'keeps declaration guards compact with CRLF',
    input: 'const token = getToken();\r\n\r\n\r\nif (!token) return;',
    expected: 'const token = getToken();\r\nif (!token) return;',
  },
  {
    name: 'keeps the current user throw guard with its return',
    input: `class AuthService {
  static currentUser() {
    const user = authStorage.getStore()?.user;
    if (!user) throw createError('AUTH_SIGN_IN_REQUIRED');

    return user;
  }
}`,
    expected: `class AuthService {
  static currentUser() {
    const user = authStorage.getStore()?.user;
    if (!user) throw createError('AUTH_SIGN_IN_REQUIRED');
    return user;
  }
}`,
  },
  {
    name: 'accepts a compact throw guard and return',
    input: 'function run() {\n  if (!user) throw error;\n  return user;\n}',
    expected: 'function run() {\n  if (!user) throw error;\n  return user;\n}',
  },
  {
    name: 'keeps throw guard returns compact with CRLF',
    input: 'function run() {\r\n  if (!user) throw error;\r\n\r\n\r\n  return user;\r\n}',
    expected: 'function run() {\r\n  if (!user) throw error;\r\n  return user;\r\n}',
  },
  {
    name: 'preserves comments between a throw guard and return',
    input:
      'function run() {\n  if (!user) throw error;\n\n  // Return current user\n  return user;\n}',
    expected:
      'function run() {\n  if (!user) throw error;\n\n  // Return current user\n  return user;\n}',
  },
  {
    name: 'keeps multiline throw guards separate from returns',
    input: 'function run() {\n  if (!user) {\n    throw error;\n  }\n  return user;\n}',
    expected: 'function run() {\n  if (!user) {\n    throw error;\n  }\n\n  return user;\n}',
  },
  {
    name: 'preserves spacing after a guard without a throw',
    input: 'function run() {\n  if (!user) logError();\n\n  return user;\n}',
    expected: 'function run() {\n  if (!user) logError();\n\n  return user;\n}',
  },
  {
    name: 'preserves spacing after a throw branch with an alternative',
    input: 'function run() {\n  if (!user) throw error; else logUser(user);\n\n  return user;\n}',
    expected:
      'function run() {\n  if (!user) throw error; else logUser(user);\n\n  return user;\n}',
  },
  {
    name: 'keeps session cleanup and return together',
    input: `function register() {
  if (
    ws.readyState !== WebSocket.OPEN ||
    Date.now() >= expires ||
    stopping ||
    accountRevision({ userId }) !== registration.revision
  ) {
    destroySession({ session });

    return;
  }
}`,
    expected: `function register() {
  if (
    ws.readyState !== WebSocket.OPEN ||
    Date.now() >= expires ||
    stopping ||
    accountRevision({ userId }) !== registration.revision
  ) {
    destroySession({ session });
    return;
  }
}`,
  },
  {
    name: 'groups short calls to the same function',
    input:
      "function stop() {\n  server.closeAllConnections();\n}\n\nprocess.once('SIGINT', stop);\n\nprocess.once('SIGTERM', stop);",
    expected:
      "function stop() {\n  server.closeAllConnections();\n}\n\nprocess.once('SIGINT', stop);\nprocess.once('SIGTERM', stop);",
  },
  {
    name: 'preserves spacing between different short calls',
    input: 'prepare();\n\nfinish();\n\nother.finish();',
    expected: 'prepare();\n\nfinish();\n\nother.finish();',
  },
  {
    name: 'does not merge short calls separated by comments',
    input: "process.once('SIGINT', stop);\n\n// Another handler\nprocess.once('SIGTERM', stop);",
    expected: "process.once('SIGINT', stop);\n\n// Another handler\nprocess.once('SIGTERM', stop);",
  },
  {
    name: 'keeps multiline calls separate from returns and matching calls',
    input:
      'function run() {\n  consume(\n    first,\n  );\n  consume(second);\n  consume(\n    third,\n  );\n  return;\n}',
    expected:
      'function run() {\n  consume(\n    first,\n  );\n\n  consume(second);\n\n  consume(\n    third,\n  );\n\n  return;\n}',
  },
  {
    name: 'keeps a single-line declaration with its return',
    input: 'function run() {\n  const value = 1;\n  return value;\n}',
    expected: 'function run() {\n  const value = 1;\n  return value;\n}',
  },
  {
    name: 'removes the blank line before the response return',
    input: `app.get('/tubu_relay', (c) => {
  c.header('Cache-Control', 'no-store');
  c.header('Content-Type', 'text/plain');

  const response = c.body('true', 200);

  return response;
});`,
    expected: `app.get('/tubu_relay', (c) => {
  c.header('Cache-Control', 'no-store');
  c.header('Content-Type', 'text/plain');

  const response = c.body('true', 200);
  return response;
});`,
  },
  {
    name: 'keeps a destructured binding with its return',
    input: 'function run() {\n  const { value } = result;\n\n  return value;\n}',
    expected: 'function run() {\n  const { value } = result;\n  return value;\n}',
  },
  {
    name: 'keeps a single-line declaration with a different returned value',
    input: 'function run() {\n  const value = 1;\n  return other;\n}',
    expected: 'function run() {\n  const value = 1;\n  return other;\n}',
  },
  ...['Account', 'Auth', 'UiBoard'].map((name) => ({
    name: `keeps the lazy ${name} import with its object return`,
    input: `const ${name} = React.lazy(async () => {
  const module = await import('#web/views/${name}.tsx');

  return { default: module.${name} };
});`,
    expected: `const ${name} = React.lazy(async () => {
  const module = await import('#web/views/${name}.tsx');
  return { default: module.${name} };
});`,
  })),
  {
    name: 'keeps a single-line declaration with a multiline return',
    input: 'function run() {\n  const value = 1;\n\n  return {\n    value,\n  };\n}',
    expected: 'function run() {\n  const value = 1;\n  return {\n    value,\n  };\n}',
  },
  {
    name: 'keeps multiline declarations separate from their return',
    input: 'function run() {\n  const value = {\n    ready: true,\n  };\n  return value;\n}',
    expected: 'function run() {\n  const value = {\n    ready: true,\n  };\n\n  return value;\n}',
  },
  {
    name: 'preserves comments between declarations and their return',
    input: 'function run() {\n  const value = 1;\n\n  // Return cached value\n  return value;\n}',
    expected:
      'function run() {\n  const value = 1;\n\n  // Return cached value\n  return value;\n}',
  },
  {
    name: 'keeps declaration returns compact with CRLF',
    input: 'function run() {\r\n  const value = 1;\r\n\r\n\r\n  return value;\r\n}',
    expected: 'function run() {\r\n  const value = 1;\r\n  return value;\r\n}',
  },
  {
    name: 'preserves comments before returns',
    input: 'function run() {\n  destroySession();\n\n  // Leave registration\n  return;\n}',
    expected: 'function run() {\n  destroySession();\n\n  // Leave registration\n  return;\n}',
  },
  {
    name: 'removes group gaps with CRLF and indentation',
    input:
      'function run() {\r\n  consume(first);\r\n\r\n\r\n  consume(second);\r\n\r\n  return value;\r\n}\r\n',
    expected:
      'function run() {\r\n  consume(first);\r\n  consume(second);\r\n  return value;\r\n}\r\n',
  },
  {
    name: 'separates connection setup into declaration and callback groups',
    input: `controls.on('connection', (ws, { token, userId }: { token: string; userId: string }) => {
  const session: Session = { ws, token, userId, hosts: [], streams: new Set(), alive: true };
  sessions.add(session);
  const timer = setTimeout(() => ws.terminate(), 5000);
  ws.on('error', () => ws.terminate());
  ws.on('pong', () => {
    session.alive = true;
  });
  let registering = false;
  const expires = Date.now() + 5000;
  ws.on('message', async (raw) => {
    await register(raw);
  });
});`,
    expected: `controls.on('connection', (ws, { token, userId }: { token: string; userId: string }) => {
  const session: Session = { ws, token, userId, hosts: [], streams: new Set(), alive: true };

  sessions.add(session);

  const timer = setTimeout(() => ws.terminate(), 5000);

  ws.on('error', () => ws.terminate());

  ws.on('pong', () => {
    session.alive = true;
  });

  let registering = false;
  const expires = Date.now() + 5000;

  ws.on('message', async (raw) => {
    await register(raw);
  });
});`,
  },
  {
    name: 'groups adjacent single-line declarations and calls',
    input: 'const a = 1;\nlet b = 2;\nconsume(a);\nconsume(b);\nconst c = 3;\nconst d = 4;',
    expected: 'const a = 1;\nlet b = 2;\n\nconsume(a);\nconsume(b);\n\nconst c = 3;\nconst d = 4;',
  },
  {
    name: 'separates multiline declarations from other declarations',
    input: 'const a = 1;\nconst values = [\n  a,\n];\nconst b = 2;',
    expected: 'const a = 1;\n\nconst values = [\n  a,\n];\n\nconst b = 2;',
  },
  {
    name: 'separates multiline calls from surrounding calls',
    input: 'prepare();\nlisten(() => {\n  run();\n});\nfinish();',
    expected: 'prepare();\n\nlisten(() => {\n  run();\n});\n\nfinish();',
  },
  {
    name: 'recognizes exported and TypeScript declarations',
    input:
      'export type Input = string;\nexport interface Value {}\nexport enum Status { Ready }\nexport const ready = true;\nexport function run() {}\nexport class Runner {}\nexport default class DefaultRunner {}\nconsume();\ntype Output = string;\ninterface Result {}\nenum State { Ready }',
    expected:
      'export type Input = string;\nexport interface Value {}\nexport enum Status { Ready }\nexport const ready = true;\nexport function run() {}\nexport class Runner {}\nexport default class DefaultRunner {}\n\nconsume();\n\ntype Output = string;\ninterface Result {}\nenum State { Ready }',
  },
  {
    name: 'checks declaration groups inside cases, static blocks and namespaces',
    input:
      'switch (value) {\ncase 1:\n  const a = 1;\n  consume(a);\n}\nclass Runner {\nstatic {\n  const b = 2;\n  consume(b);\n}\n}\nnamespace Scope {\n  const c = 3;\n  consume(c);\n}',
    expected:
      'switch (value) {\ncase 1:\n  const a = 1;\n\n  consume(a);\n}\n\nclass Runner {\nstatic {\n  const b = 2;\n\n  consume(b);\n}\n}\n\nnamespace Scope {\n  const c = 3;\n\n  consume(c);\n}',
  },
  {
    name: 'keeps leading and trailing comments with their statement groups',
    input:
      'const a = 1; // declaration\n// call explanation\nconsume(a);\n// declaration explanation\nconst b = 2;',
    expected:
      'const a = 1; // declaration\n\n// call explanation\nconsume(a);\n\n// declaration explanation\nconst b = 2;',
  },
  {
    name: 'preserves first, last and same-line statements',
    input: 'function run() {\n  const a = 1; consume(a); const b = 2;\n}\n\nfinish();',
    expected: 'function run() {\n  const a = 1; consume(a); const b = 2;\n}\n\nfinish();',
  },
  {
    name: 'preserves CRLF around declaration and multiline boundaries',
    input: 'const a = 1;\r\nconsume(a);\r\nlisten(() => {\r\n  run();\r\n});\r\nfinish();\r\n',
    expected:
      'const a = 1;\r\n\r\nconsume(a);\r\n\r\nlisten(() => {\r\n  run();\r\n});\r\n\r\nfinish();\r\n',
  },
  ...[
    'if (ready) {}',
    'for (;;) {}',
    'for (const key in value) {}',
    'for (const item of value) {}',
    'while (ready) {}',
    'do {} while (ready);',
    'switch (value) { default: break; }',
    'try {} catch {} finally {}',
  ].map((control) => ({
    name: `separates ${control}`,
    input: `prepare();\n${control}\nfinish();`,
    expected: `prepare();\n\n${control}\nfinish();`,
  })),
  {
    name: 'checks nested blocks, case bodies and static blocks',
    input:
      'function run() {\n  prepare();\n  if (ready) {}\n}\nswitch (value) {\ncase 1:\n  prepare();\n  while (ready) {}\n}\nclass Runner {\nstatic {\n  prepare();\n  try {} finally {}\n}\n}',
    expected:
      'function run() {\n  prepare();\n\n  if (ready) {}\n}\n\nswitch (value) {\ncase 1:\n  prepare();\n\n  while (ready) {}\n}\n\nclass Runner {\nstatic {\n  prepare();\n\n  try {} finally {}\n}\n}',
  },
  {
    name: 'preserves compact statements, branches and first statements',
    input:
      'if (ready) {} else if (other) {} else {}\nfunction run() {\n  while (ready) {}\n  const a = 1;\n  const b = 2;\n  consume(a, b);\n  return a;\n}\nswitch (value) {\ncase 1:\n  if (ready) {}\n}\nprepare(); if (ready) {}',
    expected:
      'if (ready) {} else if (other) {} else {}\n\nfunction run() {\n  while (ready) {}\n\n  const a = 1;\n  const b = 2;\n\n  consume(a, b);\n  return a;\n}\n\nswitch (value) {\ncase 1:\n  if (ready) {}\n}\n\nprepare(); if (ready) {}',
  },
  {
    name: 'keeps leading comments with the control statement',
    input: 'prepare(); // previous\n// explanation\n/* more context */\nif (ready) {}',
    expected: 'prepare(); // previous\n\n// explanation\n/* more context */\nif (ready) {}',
  },
  {
    name: 'preserves an existing gap before leading comments',
    input: 'prepare();\n\n// explanation\nif (ready) {}',
    expected: 'prepare();\n\n// explanation\nif (ready) {}',
  },
  {
    name: 'collapses excess blank lines throughout code',
    input: '\n\n\nconst a = 1;\n  \n\t\nconst b = 2;\n\n\ncall();\n\n\nif (ready) {}\n\n\n',
    expected: '\n\nconst a = 1;\n\nconst b = 2;\n\ncall();\n\nif (ready) {}\n\n',
  },
  {
    name: 'preserves optional single blank lines',
    input: 'const a = 1;\n\nconst b = 2;\n\ncall();',
    expected: 'const a = 1;\n\nconst b = 2;\n\ncall();',
  },
  {
    name: 'preserves literal, template, comment and JSX contents',
    input:
      'const text = "a\\n\\n\\nb";\nconst escaped = "a\\\n\\\n\\\nb";\nconst template = `a\n\n\nb${value}\n\n\nc`;\n/* a\n\n\nb */\nconst view = <div>first\n\n\nlast</div>;',
    expected:
      'const text = "a\\n\\n\\nb";\n\nconst escaped = "a\\\n\\\n\\\nb";\n\nconst template = `a\n\n\nb${value}\n\n\nc`;\n\n/* a\n\n\nb */\nconst view = <div>first\n\n\nlast</div>;',
  },
  {
    name: 'preserves CRLF and indentation',
    input: 'function run() {\r\n  prepare();\r\n  if (ready) {}\r\n\r\n\r\n  finish();\r\n}\r\n',
    expected: 'function run() {\r\n  prepare();\r\n\r\n  if (ready) {}\r\n\r\n  finish();\r\n}\r\n',
  },
];

test('exports block-spacing through the aggregate plugin', () => {
  assert.equal(plugin.rules['block-spacing'], blockSpacing.rules['block-spacing']);
});

for (const scenario of scenarios) {
  test(scenario.name, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'block-spacing-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const filename = join(directory, 'example.tsx');
    const config = join(directory, '.oxlintrc.json');
    writeFileSync(filename, scenario.input);
    writeFileSync(
      config,
      JSON.stringify({
        categories: { correctness: 'off' },
        jsPlugins: [
          {
            name: 'better',
            specifier: fileURLToPath(new URL('../dist/index.js', import.meta.url)),
          },
        ],
        rules: { 'better/block-spacing': 'error' },
      }),
    );
    let status = 0;
    let output = '';

    try {
      const check = await executeFile(process.execPath, [cli, '-c', config, filename], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30_000,
      });
      output = check.stdout + check.stderr;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'number') {
        throw error;
      }

      status = error.code;
      output = error.message;
    }

    assert.equal(status, scenario.input === scenario.expected ? 0 : 1, output);

    for (let pass = 0; pass < 2; pass++) {
      await executeFile(process.execPath, [cli, '-c', config, '--fix', filename], {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30_000,
      });
      assert.equal(readFileSync(filename, 'utf8'), scenario.expected);
    }
  });
}
