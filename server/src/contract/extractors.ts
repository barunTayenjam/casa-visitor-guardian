export interface RouteEntry {
  method: string;
  path: string;
  file: string;
}

export interface CallEntry {
  method: string;
  path: string;
  file: string;
}

export interface MountEntry {
  prefix: string;
  routerVariable: string;
  routeFile: string;
}

export function normalizePath(raw: string): string {
  let p = raw.replace(/\$\{API_URL\}/g, '/api').replace(/API_URL/g, '/api');
  const cut = p.search(/[?#]/);
  if (cut !== -1) p = p.slice(0, cut);
  p = p.replace(/:[A-Za-z0-9_]+/g, '*');
  p = p.replace(/\$\{[^}]*\}/g, '*');
  p = p.replace(/\/{2,}/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  return p;
}

export function matchPath(pattern: string, actual: string): boolean {
  const p = normalizePath(pattern).split('/');
  const a = normalizePath(actual).split('/');
  if (p.length !== a.length) return false;
  return p.every((seg, i) => (seg === '*' ? a[i].length > 0 : seg === a[i]));
}

export function parseMounts(source: string): MountEntry[] {
  const imports = new Map<string, string>();
  const importRe = /import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s*from\s+['"]\.\/([^'"]+)\.js['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    imports.set(m[1], m[2]);
  }
  const entries: MountEntry[] = [];
  const mountRe = /app\.use\(\s*(['"])(\/[^'"]*)\1\s*,\s*(\w+)\s*\)/g;
  while ((m = mountRe.exec(source)) !== null) {
    const prefix = m[2];
    const routerVariable = m[3];
    if (!prefix.startsWith('/api')) continue;
    const routeFile = imports.get(routerVariable);
    if (!routeFile) continue;
    entries.push({ prefix, routerVariable, routeFile });
  }
  return entries;
}

export function parseRouteSource(source: string, fileLabel: string): RouteEntry[] {
  const entries: RouteEntry[] = [];
  const re = /router\.(get|post|put|delete|patch)\s*\(\s*(['"])([^'"]*)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    entries.push({ method: m[1].toLowerCase(), path: m[3], file: fileLabel });
  }
  return entries;
}

export function parseConfigureSource(source: string, fileLabel: string): RouteEntry[] {
  const entries: RouteEntry[] = [];
  const re = /app\.(get|post|put|delete|patch)\s*\(\s*(['"])(\/[^'"]*)\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (!m[3].startsWith('/api')) continue;
    entries.push({ method: m[1].toLowerCase(), path: m[3], file: fileLabel });
  }
  return entries;
}

const CALL_NAME_RE =
  /\b(fetchWithRetry|fetch|apiGet|apiPost|apiPut|apiDelete|apiClient\.(?:get|post|put|delete|patch))\s*(?:<[\s\S]*?>)?\s*\(/g;

const API_ROOTED_NAMES = new Set([
  'apiget',
  'apipost',
  'apiput',
  'apidelete',
  'apiclient.get',
  'apiclient.post',
  'apiclient.put',
  'apiclient.delete',
  'apiclient.patch',
]);

const NAME_VERBS: Record<string, string> = {
  apiget: 'get',
  apipost: 'post',
  apiput: 'put',
  apidelete: 'delete',
  'apiclient.get': 'get',
  'apiclient.post': 'post',
  'apiclient.put': 'put',
  'apiclient.delete': 'delete',
  'apiclient.patch': 'patch',
};

function extractCallBody(source: string, openIdx: number): string | null {
  let depth = 1;
  let i = openIdx + 1;
  let inStr: string | null = null;
  while (i < source.length) {
    const c = source[i];
    if (inStr) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
    } else if (c === "'" || c === '"' || c === '`') {
      inStr = c;
    } else if (c === '(') {
      depth += 1;
    } else if (c === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIdx + 1, i);
    }
    i += 1;
  }
  return null;
}

function firstArgLiteral(body: string): string | null {
  const m = /^\s*(['"`])/.exec(body);
  if (!m) return null;
  const quote = m[1];
  const start = m.index + m[0].length;
  const end = body.indexOf(quote, start);
  if (end === -1) return null;
  return body.slice(start, end);
}

function transformPath(literal: string, apiRooted: boolean): string {
  let path = literal.replace(/\$\{API_URL\}/g, '/api').replace(/API_URL/g, '/api');
  if (apiRooted && !path.startsWith('/api')) {
    path = '/api' + (path.startsWith('/') ? path : '/' + path);
  }
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  return path;
}

export function parseFrontendSource(source: string, fileLabel: string): CallEntry[] {
  const entries: CallEntry[] = [];
  const seen = new Set<string>();

  const push = (path: string, method: string): void => {
    const norm = normalizePath(path);
    if (!norm.startsWith('/api/')) return;
    const key = `${method} ${norm}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ method, path, file: fileLabel });
  };

  const varLits = new Map<string, string[]>();
  const initRe = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+);/g;
  let im: RegExpExecArray | null;
  while ((im = initRe.exec(source)) !== null) {
    const litRe = /(['"`])([^'"`]*)\1/g;
    let lm: RegExpExecArray | null;
    const lits: string[] = [];
    while ((lm = litRe.exec(im[2])) !== null) {
      if (lm[2]) lits.push(lm[2]);
    }
    if (lits.length) varLits.set(im[1], [...(varLits.get(im[1]) ?? []), ...lits]);
  }

  const callRe = new RegExp(CALL_NAME_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(source)) !== null) {
    const name = m[1];
    const openIdx = callRe.lastIndex - 1;
    const body = extractCallBody(source, openIdx);
    if (body === null) continue;
    const direct = firstArgLiteral(body);
    let literals: string[];
    let fromVar = false;
    if (direct !== null) {
      literals = [direct];
    } else {
      const idm = /^\s*(\w+)/.exec(body);
      if (!idm || !varLits.has(idm[1])) continue;
      literals = varLits.get(idm[1])!;
      fromVar = true;
    }
    const nameLower = name.toLowerCase();
    let method = NAME_VERBS[nameLower];
    if (!method) {
      const methodMatch = /method\s*:\s*['"](\w+)['"]/i.exec(body);
      method = methodMatch ? methodMatch[1].toLowerCase() : 'get';
    }
    const apiRooted = API_ROOTED_NAMES.has(nameLower);
    for (const lit of literals) {
      let path = transformPath(lit, apiRooted);
      if (fromVar) {
        const exprCut = path.search(/\$\{/);
        if (exprCut !== -1) path = path.slice(0, exprCut);
      }
      push(path, method);
    }
  }

  const returnRe = /return\s+`([^`]*)`/g;
  while ((m = returnRe.exec(source)) !== null) {
    push(transformPath(m[1], false), 'get');
  }

  return entries;
}
