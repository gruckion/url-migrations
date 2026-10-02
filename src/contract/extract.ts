import path from 'node:path';
import ts from 'typescript';

import { ancestorDirs, isPageFile, routeFromPageFile } from './routes';
import { mergeShapes } from './shape';
import type { Contract, ExtractResult, ExtractWarning, ParamOrigin, ParamShape, RouteContract } from './types';

export interface ExtractOptions {
  /** Project root that holds the tsconfig. */
  root: string;
  /** App router directory, relative to `root`. Default `app`. */
  appDir?: string;
  /** Path to the tsconfig, relative to `root`. Default `tsconfig.json`. */
  tsconfig?: string;
}

interface FoundParam {
  key: string;
  shape: ParamShape;
  line: number;
  /** The top-level declaration whose code reads this param. */
  owner: ts.Node;
}

interface FileFacts {
  params: FoundParam[];
  /** Top-level declarations that read URL state a scan cannot list. */
  opaque: Set<ts.Node>;
  warnings: ExtractWarning[];
}

interface Ctx {
  checker: ts.TypeChecker;
  sf: ts.SourceFile;
  root: string;
  warn: (node: ts.Node, message: string) => void;
}

const SCHEMA_CALLS = new Set(['useQueryStates', 'createLoader', 'createSerializer', 'createSearchParamsCache']);
const ARRAY_GETTERS = new Set(['get', 'getAll', 'has']);

export function extractContract(options: ExtractOptions): ExtractResult {
  const root = path.resolve(options.root);
  const appDir = path.resolve(root, options.appDir ?? 'app');
  const configPath = path.resolve(root, options.tsconfig ?? 'tsconfig.json');

  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
  const checker = program.getTypeChecker();

  const factsCache = new Map<string, FileFacts>();
  const refsCache = new Map<ts.Node, ts.Node[]>();
  const warnings: ExtractWarning[] = [];

  function relative(file: string): string {
    return path.relative(root, file);
  }

  function inProject(sf: ts.SourceFile): boolean {
    return !sf.isDeclarationFile && sf.fileName.startsWith(root + path.sep) && !sf.fileName.includes('/node_modules/');
  }

  function factsFor(sf: ts.SourceFile): FileFacts {
    const cached = factsCache.get(sf.fileName);
    if (cached) return cached;
    const facts: FileFacts = { params: [], opaque: new Set(), warnings: [] };
    factsCache.set(sf.fileName, facts);
    const ctx: Ctx = {
      checker,
      sf,
      root,
      warn: (node, message) => {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        facts.warnings.push({ file: relative(sf.fileName), line: line + 1, message });
      },
    };
    analyzeFile(ctx, facts, isPageFile(sf.fileName));
    return facts;
  }

  function topLevelDeclarations(sf: ts.SourceFile): ts.Node[] {
    const nodes: ts.Node[] = [];
    for (const statement of sf.statements) {
      if (ts.isVariableStatement(statement)) nodes.push(...statement.declarationList.declarations);
      else nodes.push(statement);
    }
    return nodes;
  }

  /** Top-level declarations a declaration refers to, through imports and re-exports. */
  function referencesOf(node: ts.Node): ts.Node[] {
    const cached = refsCache.get(node);
    if (cached) return cached;
    const found = new Set<ts.Node>();
    refsCache.set(node, []);
    const visit = (n: ts.Node) => {
      if (ts.isIdentifier(n)) {
        for (const target of targetsOf(n)) found.add(target);
      } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [arg] = n.arguments;
        if (arg && ts.isStringLiteralLike(arg)) {
          const resolved = ts.resolveModuleName(arg.text, node.getSourceFile().fileName, parsed.options, ts.sys);
          const target = resolved.resolvedModule && program.getSourceFile(resolved.resolvedModule.resolvedFileName);
          if (target && inProject(target)) for (const d of topLevelDeclarations(target)) found.add(d);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    const refs = [...found];
    refsCache.set(node, refs);
    return refs;
  }

  function targetsOf(id: ts.Identifier): ts.Node[] {
    let symbol = ts.isShorthandPropertyAssignment(id.parent)
      ? checker.getShorthandAssignmentValueSymbol(id.parent)
      : checker.getSymbolAtLocation(id);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const targets: ts.Node[] = [];
    for (const decl of symbol?.declarations ?? []) {
      if (ts.isSourceFile(decl) || !inProject(decl.getSourceFile())) continue;
      targets.push(topLevelOf(decl));
    }
    return targets;
  }

  const pages = program
    .getSourceFiles()
    .filter((sf) => isPageFile(sf.fileName) && sf.fileName.startsWith(appDir + path.sep));

  const routes: Record<string, RouteContract> = {};
  const origins: ParamOrigin[] = [];
  const visited = new Set<ts.Node>();

  for (const page of pages) {
    const route = routeFromPageFile(appDir, page.fileName);
    if (route === null) continue;

    const entryFiles = [page];
    for (const dir of ancestorDirs(appDir, page.fileName)) {
      for (const name of ['layout.tsx', 'layout.ts', 'layout.jsx', 'layout.js']) {
        const layout = program.getSourceFile(path.join(dir, name));
        if (layout) entryFiles.push(layout);
      }
    }

    const seen = new Set<ts.Node>();
    const stack: ts.Node[] = entryFiles.flatMap(defaultExportDeclarations);
    const contract: RouteContract = routes[route] ?? { params: {} };
    routes[route] = contract;
    while (stack.length) {
      const node = stack.pop();
      if (node === undefined || seen.has(node)) continue;
      seen.add(node);
      visited.add(node);
      const facts = factsFor(node.getSourceFile());
      if (facts.opaque.has(node)) contract.opaque = true;
      for (const param of facts.params) {
        if (param.owner !== node) continue;
        const existing = contract.params[param.key];
        contract.params[param.key] = existing ? mergeShapes(existing, param.shape) : param.shape;
        origins.push({ route, key: param.key, file: relative(node.getSourceFile().fileName), line: param.line });
      }
      stack.push(...referencesOf(node));
    }
  }

  for (const facts of factsCache.values()) warnings.push(...facts.warnings);
  warnings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const sortedRoutes: Record<string, RouteContract> = {};
  for (const route of Object.keys(routes).sort()) {
    const entry = routes[route];
    if (!entry) continue;
    const params: Record<string, ParamShape> = {};
    for (const key of Object.keys(entry.params).sort()) {
      const shape = entry.params[key];
      if (shape) params[key] = shape;
    }
    sortedRoutes[route] = entry.opaque ? { params, opaque: true } : { params };
  }
  const contract: Contract = { version: 1, routes: sortedRoutes };
  return { contract, warnings, origins, stats: { pages: Object.keys(sortedRoutes).length, filesScanned: visited.size } };
}

/** `export default function Page` and `export default Page;`. */
function defaultExportDeclarations(sf: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [];
  for (const statement of sf.statements) {
    if (ts.isExportAssignment(statement)) nodes.push(statement);
    else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      nodes.push(statement);
    }
  }
  return nodes;
}

/** The statement-level declaration that contains `node`. Variable declarations count individually. */
function topLevelOf(node: ts.Node): ts.Node {
  let current = node;
  while (current.parent && !ts.isSourceFile(current.parent)) {
    if (
      ts.isVariableDeclaration(current) &&
      ts.isVariableDeclarationList(current.parent) &&
      ts.isVariableStatement(current.parent.parent) &&
      ts.isSourceFile(current.parent.parent.parent)
    ) {
      return current;
    }
    current = current.parent;
  }
  return current;
}

function analyzeFile(ctx: Ctx, facts: FileFacts, isPage: boolean) {
  const searchParamsVars = new Set<ts.Symbol>();

  const add = (node: ts.Node, key: string | null, shape: ParamShape) => {
    if (key === null) {
      facts.opaque.add(topLevelOf(node));
      ctx.warn(node, 'URL param key is not a literal, so it cannot be listed');
      return;
    }
    const { line } = ctx.sf.getLineAndCharacterOfPosition(node.getStart(ctx.sf));
    facts.params.push({ key, shape, line: line + 1, owner: topLevelOf(node) });
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) handleCall(node);
    if (ts.isVariableDeclaration(node) && node.initializer && isUseSearchParamsCall(ctx, node.initializer)) {
      const symbol = ctx.checker.getSymbolAtLocation(node.name);
      if (symbol) searchParamsVars.add(symbol);
    }
    ts.forEachChild(node, visit);
  };

  const handleCall = (call: ts.CallExpression) => {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) {
      const name = nuqsImport(ctx, callee);
      if (name === 'useQueryState') {
        const [keyArg, parserArg] = call.arguments;
        const key = keyArg ? literalString(ctx, keyArg) : null;
        add(call, key, parserArg ? shapeOf(ctx, parserArg) : { kind: 'string' });
      } else if (name !== null && SCHEMA_CALLS.has(name)) {
        const [schemaArg, optionsArg] = call.arguments;
        if (!schemaArg) return;
        const urlKeys = optionsArg ? readUrlKeys(ctx, optionsArg) : new Map<string, string>();
        for (const entry of schemaEntries(ctx, schemaArg, call)) {
          const urlKey = entry.key === null ? null : urlKeys.get(entry.key);
          add(call, urlKey === undefined ? entry.key : urlKey, entry.shape);
        }
      }
    }
    // `useSearchParams().get('x')` read inline.
    if (ts.isPropertyAccessExpression(callee) && ARRAY_GETTERS.has(callee.name.text)) {
      if (isUseSearchParamsCall(ctx, callee.expression)) {
        const [keyArg] = call.arguments;
        add(call, keyArg ? literalString(ctx, keyArg) : null, { kind: 'untyped' });
      }
    }
  };

  visit(ctx.sf);

  // Reads through a variable: every use must be `.get/.getAll/.has('literal')`, or the route is opaque.
  if (searchParamsVars.size) {
    const check = (node: ts.Node) => {
      if (ts.isIdentifier(node)) {
        const symbol = ctx.checker.getSymbolAtLocation(node);
        const isDeclarationName = ts.isVariableDeclaration(node.parent) && node.parent.name === node;
        if (symbol && searchParamsVars.has(symbol) && !isDeclarationName) {
          const parent = node.parent;
          if (
            ts.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            ARRAY_GETTERS.has(parent.name.text) &&
            ts.isCallExpression(parent.parent)
          ) {
            const [keyArg] = parent.parent.arguments;
            const key = keyArg ? literalString(ctx, keyArg) : null;
            add(parent.parent, key, { kind: 'untyped' });
          } else {
            facts.opaque.add(topLevelOf(node));
            ctx.warn(node, 'search params passed on or read without a literal key, so they cannot be listed');
          }
        }
      }
      ts.forEachChild(node, check);
    };
    check(ctx.sf);
  }

  if (isPage) readPageProps(ctx, facts, add);
}

function isUseSearchParamsCall(ctx: Ctx, expr: ts.Expression): boolean {
  const e = unwrap(expr);
  if (!ts.isCallExpression(e) || !ts.isIdentifier(e.expression)) return false;
  if (e.expression.text !== 'useSearchParams') return false;
  const decl = ctx.checker.getSymbolAtLocation(e.expression)?.declarations?.[0];
  return decl !== undefined && ts.isImportSpecifier(decl) && importModule(decl) === 'next/navigation';
}

/** `export default function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> })` */
function readPageProps(
  ctx: Ctx,
  facts: FileFacts,
  add: (node: ts.Node, key: string | null, shape: ParamShape) => void
) {
  for (const statement of ctx.sf.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue;
    const isDefault = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    const [param] = statement.parameters;
    if (!isDefault || !param?.type || !ts.isTypeLiteralNode(param.type)) continue;
    for (const member of param.type.members) {
      if (!ts.isPropertySignature(member) || !member.type || memberName(member.name) !== 'searchParams') continue;
      let type: ts.TypeNode = member.type;
      if (ts.isTypeReferenceNode(type) && type.typeName.getText(ctx.sf) === 'Promise' && type.typeArguments?.[0]) {
        type = type.typeArguments[0];
      }
      if (!ts.isTypeLiteralNode(type)) {
        facts.opaque.add(topLevelOf(member));
        ctx.warn(member, 'page searchParams type is not an inline object type, so its keys cannot be listed');
        continue;
      }
      for (const prop of type.members) {
        if (!ts.isPropertySignature(prop)) continue;
        add(prop, memberName(prop.name), prop.type ? shapeFromType(prop.type) : { kind: 'untyped' });
      }
    }
  }
}

function shapeFromType(type: ts.TypeNode): ParamShape {
  if (ts.isArrayTypeNode(type)) return { kind: 'array', item: shapeFromType(type.elementType), separator: 'native' };
  if (ts.isUnionTypeNode(type)) {
    const literals: string[] = [];
    for (const member of type.types) {
      if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) literals.push(member.literal.text);
      else if (member.kind === ts.SyntaxKind.UndefinedKeyword) continue;
      else return { kind: 'string' };
    }
    if (literals.length) return { kind: 'enum', values: literals.sort() };
  }
  return { kind: 'string' };
}

function memberName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return null;
}

function importModule(decl: ts.ImportSpecifier): string | null {
  const specifier = decl.parent.parent.parent.moduleSpecifier;
  return ts.isStringLiteral(specifier) ? specifier.text : null;
}

/** The nuqs export a callee refers to, or null when it is not imported from nuqs. */
function nuqsImport(ctx: Ctx, id: ts.Identifier): string | null {
  const decl = ctx.checker.getSymbolAtLocation(id)?.declarations?.[0];
  if (!decl || !ts.isImportSpecifier(decl)) return null;
  const module = importModule(decl);
  if (module === null || !/^nuqs(\/|$)/.test(module)) return null;
  return (decl.propertyName ?? decl.name).text;
}

function unwrap(expr: ts.Expression): ts.Expression {
  let current = expr;
  for (;;) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
}

function resolveInitializer(ctx: Ctx, id: ts.Identifier): ts.Expression | null {
  let symbol = ctx.checker.getSymbolAtLocation(id);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    const aliased = ctx.checker.getAliasedSymbol(symbol);
    symbol = aliased.declarations?.length ? aliased : undefined;
  }
  for (const decl of symbol?.declarations ?? []) {
    if (ts.isVariableDeclaration(decl) && decl.initializer) return decl.initializer;
    if (ts.isShorthandPropertyAssignment(decl)) {
      const value = ctx.checker.getShorthandAssignmentValueSymbol(decl);
      const valueDecl = value?.valueDeclaration;
      if (valueDecl && ts.isVariableDeclaration(valueDecl) && valueDecl.initializer) return valueDecl.initializer;
    }
  }
  return null;
}

function literalString(ctx: Ctx, expr: ts.Expression, depth = 0): string | null {
  const e = unwrap(expr);
  if (ts.isStringLiteralLike(e)) return e.text;
  if (ts.isNumericLiteral(e)) return e.text;
  if (ts.isIdentifier(e) && depth < 6) {
    const init = resolveInitializer(ctx, e);
    return init ? literalString(ctx, init, depth + 1) : null;
  }
  return null;
}

function readUrlKeys(ctx: Ctx, expr: ts.Expression): Map<string, string> {
  const map = new Map<string, string>();
  const options = unwrap(expr);
  if (!ts.isObjectLiteralExpression(options)) return map;
  for (const prop of options.properties) {
    if (!ts.isPropertyAssignment(prop) || memberName(prop.name) !== 'urlKeys') continue;
    const keys = unwrap(prop.initializer);
    if (!ts.isObjectLiteralExpression(keys)) continue;
    for (const entry of keys.properties) {
      if (!ts.isPropertyAssignment(entry)) continue;
      const from = memberName(entry.name);
      const to = literalString(ctx, entry.initializer);
      if (from !== null && to !== null) map.set(from, to);
    }
  }
  return map;
}

function schemaEntries(
  ctx: Ctx,
  expr: ts.Expression,
  at: ts.Node,
  depth = 0
): Array<{ key: string | null; shape: ParamShape }> {
  const e = unwrap(expr);
  if (depth > 6) return [];
  if (ts.isIdentifier(e)) {
    const init = resolveInitializer(ctx, e);
    if (init) return schemaEntries(ctx, init, at, depth + 1);
    ctx.warn(at, `schema "${e.text}" could not be resolved`);
    return [{ key: null, shape: { kind: 'untyped' } }];
  }
  if (!ts.isObjectLiteralExpression(e)) {
    ctx.warn(at, 'schema is not an object literal');
    return [{ key: null, shape: { kind: 'untyped' } }];
  }
  const entries: Array<{ key: string | null; shape: ParamShape }> = [];
  for (const prop of e.properties) {
    if (ts.isPropertyAssignment(prop)) {
      entries.push({ key: memberName(prop.name), shape: shapeOf(ctx, prop.initializer) });
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      entries.push({ key: prop.name.text, shape: shapeOf(ctx, prop.name) });
    } else if (ts.isSpreadAssignment(prop)) {
      entries.push(...schemaEntries(ctx, prop.expression, at, depth + 1));
    }
  }
  return entries;
}

const SIMPLE_PARSERS: Record<string, ParamShape> = {
  parseAsString: { kind: 'string' },
  parseAsInteger: { kind: 'integer' },
  parseAsIndex: { kind: 'integer' },
  parseAsHex: { kind: 'integer' },
  parseAsFloat: { kind: 'float' },
  parseAsBoolean: { kind: 'boolean' },
  parseAsIsoDate: { kind: 'date' },
  parseAsIsoDateTime: { kind: 'datetime' },
  parseAsTimestamp: { kind: 'timestamp' },
  parseAsJson: { kind: 'json' },
};

function shapeOf(ctx: Ctx, expr: ts.Expression, depth = 0, hint?: string): ParamShape {
  const e = unwrap(expr);
  if (depth > 8) return { kind: 'custom', name: hint ?? 'unresolved' };

  if (ts.isCallExpression(e)) {
    const callee = e.expression;
    if (ts.isPropertyAccessExpression(callee) && ['withDefault', 'withOptions'].includes(callee.name.text)) {
      return shapeOf(ctx, callee.expression, depth + 1, hint);
    }
    if (ts.isIdentifier(callee)) {
      const name = nuqsImport(ctx, callee);
      if (name !== null) return builtinCall(ctx, name, e, depth, hint);
      return { kind: 'custom', name: hint ?? callee.text };
    }
    return { kind: 'custom', name: hint ?? 'unresolved' };
  }

  if (ts.isIdentifier(e)) {
    const name = nuqsImport(ctx, e);
    if (name !== null) return SIMPLE_PARSERS[name] ?? { kind: 'custom', name };
    const init = resolveInitializer(ctx, e);
    return init ? shapeOf(ctx, init, depth + 1, e.text) : { kind: 'custom', name: e.text };
  }

  return { kind: 'custom', name: hint ?? 'unresolved' };
}

function builtinCall(ctx: Ctx, name: string, call: ts.CallExpression, depth: number, hint?: string): ParamShape {
  const [first, second] = call.arguments;
  switch (name) {
    case 'parseAsArrayOf': {
      const separator = second ? literalString(ctx, second) : ',';
      return {
        kind: 'array',
        item: first ? shapeOf(ctx, first, depth + 1) : { kind: 'string' },
        separator: separator ?? ',',
      };
    }
    case 'parseAsNativeArrayOf':
      return { kind: 'array', item: first ? shapeOf(ctx, first, depth + 1) : { kind: 'string' }, separator: 'native' };
    case 'parseAsStringLiteral':
    case 'parseAsStringEnum':
    case 'parseAsNumberLiteral': {
      const values = first ? valueList(ctx, first) : null;
      if (values === null) {
        ctx.warn(call, `${name} values could not be read statically`);
        return { kind: 'enum', values: [], dynamic: true };
      }
      return { kind: 'enum', values: [...new Set(values)].sort() };
    }
    case 'parseAsJson':
      return { kind: 'json' };
    case 'createParser':
      return { kind: 'custom', name: hint ?? 'createParser' };
    default:
      return SIMPLE_PARSERS[name] ?? { kind: 'custom', name };
  }
}

/** Values of `['a', 'b'] as const`, a const array, spreads of those, or `Object.values(Enum)`. */
function valueList(ctx: Ctx, expr: ts.Expression, depth = 0): string[] | null {
  const e = unwrap(expr);
  if (depth > 6) return null;
  if (ts.isArrayLiteralExpression(e)) {
    const values: string[] = [];
    for (const element of e.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = valueList(ctx, element.expression, depth + 1);
        if (spread === null) return null;
        values.push(...spread);
      } else {
        const value = literalString(ctx, element);
        if (value === null) return null;
        values.push(value);
      }
    }
    return values;
  }
  if (ts.isIdentifier(e)) {
    const init = resolveInitializer(ctx, e);
    if (init) return valueList(ctx, init, depth + 1);
    return enumValues(ctx, e);
  }
  if (
    ts.isCallExpression(e) &&
    ts.isPropertyAccessExpression(e.expression) &&
    e.expression.expression.getText(ctx.sf) === 'Object' &&
    e.expression.name.text === 'values'
  ) {
    const [target] = e.arguments;
    if (!target) return null;
    const inner = unwrap(target);
    if (ts.isIdentifier(inner)) {
      const fromEnum = enumValues(ctx, inner);
      if (fromEnum) return fromEnum;
      const init = resolveInitializer(ctx, inner);
      if (init) return objectValues(ctx, init);
    }
    return null;
  }
  return null;
}

function objectValues(ctx: Ctx, expr: ts.Expression): string[] | null {
  const e = unwrap(expr);
  if (!ts.isObjectLiteralExpression(e)) return null;
  const values: string[] = [];
  for (const prop of e.properties) {
    if (!ts.isPropertyAssignment(prop)) return null;
    const value = literalString(ctx, prop.initializer);
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

function enumValues(ctx: Ctx, id: ts.Identifier): string[] | null {
  let symbol = ctx.checker.getSymbolAtLocation(id);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = ctx.checker.getAliasedSymbol(symbol);
  const decl = symbol?.declarations?.find(ts.isEnumDeclaration);
  if (!decl) return null;
  const values: string[] = [];
  for (const member of decl.members) {
    if (!member.initializer || !ts.isStringLiteralLike(member.initializer)) return null;
    values.push(member.initializer.text);
  }
  return values;
}
