import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

export const rules = [
  { id: 'L1', from: /^backend\/core\/src\/services\//, to: /^backend\/core\/src\/(controllers|routes)\//, description: 'Services must not depend on controllers or routes, including through barrels.' },
  { id: 'L2', from: /^backend\/core\/src\/validation\//, to: /^backend\/core\/src\/(controllers|routes|services)\//, description: 'Validation must not depend on controllers, routes or services.' },
  { id: 'L3', from: /^frontend\//, to: /^backend\//, description: 'Frontend source must not depend on backend implementation files.' },
  { id: 'L4', from: /^backend\/core\//, to: /^frontend\//, description: 'Core source must not depend on frontend implementation files.' },
];
const slash = value => value.replaceAll('\\', '/');
const ignored = new Set(['node_modules', '.next', 'coverage', 'dist', '__mocks__', '__pycache__']);
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(target);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec|totest|stories)\./.test(entry.name) && !/\.d\.ts$/.test(entry.name) && entry.name !== 'testMocks.tsx' ? [target] : [];
  });
}
function imports(file, contents) {
  const ast = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);
  const entries = [];
  const unsupported = [];
  function visit(node) {
    let value;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) value = node.moduleSpecifier;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) value = node.moduleReference.expression;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) value = node.argument.literal;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      value = node.arguments[0];
      if (!value || !(ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) unsupported.push(ast.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) entries.push({ specifier: value.text, line: ast.getLineAndCharacterOfPosition(value.getStart()).line + 1 });
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { entries, unsupported, syntaxErrors: ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')) };
}
export function inspect(root) {
  const files = [path.join(root, 'frontend/app'), path.join(root, 'frontend/components'), path.join(root, 'frontend/lib'), path.join(root, 'backend/core/src')].flatMap(walk);
  if (fs.existsSync(path.join(root, 'frontend/middleware.ts'))) files.push(path.join(root, 'frontend/middleware.ts'));
  const graph = new Map();
  const errors = [];
  const edges = [];
  const frontendOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: path.join(root, 'frontend'), paths: { '@/*': ['./*'] }, allowJs: true };
  const coreOptions = { moduleResolution: ts.ModuleResolutionKind.Node16, allowJs: true };
  for (const file of files) {
    const source = slash(path.relative(root, file));
    const parsed = imports(file, fs.readFileSync(file, 'utf8'));
    errors.push(...parsed.syntaxErrors.map(message => ({ file: source, message })), ...parsed.unsupported.map(line => ({ file: source, line, message: 'Non-literal import cannot be verified statically.' })));
    const outgoing = [];
    for (const entry of parsed.entries) {
      // Asset imports are not application-module dependencies.
      if (/\.(css|scss|sass|png|jpe?g|svg|webp|gif|woff2?|ttf)$/i.test(entry.specifier)) continue;
      const resolved = ts.resolveModuleName(entry.specifier, file, source.startsWith('frontend/') ? frontendOptions : coreOptions, ts.sys).resolvedModule;
      if (!resolved) {
        if (entry.specifier.startsWith('.') || entry.specifier.startsWith('@/')) errors.push({ file: source, ...entry, message: 'Unresolved internal import.' });
        continue;
      }
      const target = slash(path.relative(root, resolved.resolvedFileName));
      if (target.includes('node_modules/')) continue;
      outgoing.push(target);
      edges.push({ source, target, line: entry.line, specifier: entry.specifier });
    }
    graph.set(source, [...new Set(outgoing)]);
  }
  const violations = [];
  for (const [source] of graph) {
    for (const rule of rules.filter(r => r.from.test(source))) {
      const visited = new Set([source]);
      const queue = [[source]];
      while (queue.length) {
        const trail = queue.shift();
        for (const target of graph.get(trail.at(-1)) ?? []) {
          if (visited.has(target)) continue;
          visited.add(target);
          const dependencyPath = [...trail, target];
          if (rule.to.test(target)) violations.push({ rule: rule.id, source, target, dependencyPath });
          queue.push(dependencyPath);
        }
      }
    }
  }
  return { filesChecked: files.length, edgesChecked: edges.length, rules: rules.map(({ id, description }) => ({ id, description })), violations, errors, edges, passed: files.length > 0 && violations.length === 0 && errors.length === 0 };
}

// Execute the real parser/resolver against allowed, direct, aliased and barrel fixtures.
export function selfTest(dir) {
  const cases = [
    { name: 'allowed-service-to-validation', files: { 'backend/core/src/services/s.ts': "import '../validation/v';", 'backend/core/src/validation/v.ts': 'export const v = true;' }, expected: [] },
    { name: 'service-to-controller', files: { 'backend/core/src/services/s.ts': "import '../controllers/c';", 'backend/core/src/controllers/c.ts': 'export const c = true;' }, expected: ['L1'] },
    { name: 'validation-to-service', files: { 'backend/core/src/validation/v.ts': "import '../services/s';", 'backend/core/src/services/s.ts': 'export const s = true;' }, expected: ['L2'] },
    { name: 'frontend-barrel-to-backend', files: { 'frontend/app/a.ts': "import '@/lib/barrel';", 'frontend/lib/barrel.ts': "export * from '../../backend/core/src/services/s';", 'backend/core/src/services/s.ts': 'export const s = true;' }, expected: ['L3'] },
    { name: 'backend-to-frontend', files: { 'backend/core/src/services/s.ts': "import '../../../../frontend/lib/l';", 'frontend/lib/l.ts': 'export const l = true;' }, expected: ['L4'] },
    { name: 'dynamic-require', files: { 'frontend/lib/l.ts': 'const name = "./unknown"; require(name);' }, expected: [], expectedError: true },
  ];
  return cases.map(test => {
    const root = path.join(dir, test.name);
    for (const [name, value] of Object.entries(test.files)) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), value);
    }
    const result = inspect(root);
    const actual = [...new Set(result.violations.map(v => v.rule))].sort();
    return { name: test.name, expected: test.expected, actual, passed: JSON.stringify(actual) === JSON.stringify(test.expected) && (test.expectedError ? result.errors.length > 0 : result.errors.length === 0), result };
  });
}
