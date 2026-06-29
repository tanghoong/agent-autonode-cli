/**
 * A small, self-contained JSONPath evaluator for the `transform.json` connector.
 *
 * It intentionally implements only a safe, eval-free subset — consistent with
 * the project's stance of avoiding `new Function()` / `eval` and heavy
 * third-party parsers. Supported syntax:
 *
 *   $                    the root value
 *   .name  ['name']      member access (dot or bracket, single/double quotes)
 *   [n]                  array index (negative counts from the end)
 *   [*]  .*              wildcard — all array elements or all object values
 *   [?(@.path <op> lit)] filter array elements; op ∈ === !== == != >= <= > <
 *                        lit ∈ true | false | null | number | 'string' | "string"
 *
 * Every query returns an array of all matched values (standard JSONPath
 * semantics), so callers get a predictable shape regardless of the path.
 * Unsupported constructs throw a descriptive error rather than silently
 * mis-evaluating.
 */

type Primitive = string | number | boolean | null;

type Segment =
  | { kind: 'member'; name: string }
  | { kind: 'index'; index: number }
  | { kind: 'wildcard' }
  | { kind: 'filter'; path: string[]; op: ComparisonOperator; value: Primitive };

type ComparisonOperator = '===' | '!==' | '==' | '!=' | '>=' | '<=' | '>' | '<';

const COMPARISON_OPERATORS: ComparisonOperator[] = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Walks a literal property path (e.g. ['user', 'name']) into a value. */
function getByPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (isRecord(current)) {
      current = current[key];
    } else if (Array.isArray(current)) {
      current = current[Number(key)];
    } else {
      return undefined;
    }
  }
  return current;
}

function parsePrimitive(raw: string, expression: string): Primitive {
  const token = raw.trim();
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'null') return null;
  if (
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'))
  ) {
    return token.slice(1, -1);
  }
  const num = Number(token);
  if (token !== '' && !Number.isNaN(num)) return num;
  throw new Error(`transform.json: invalid filter literal '${raw}' in expression '${expression}'`);
}

function parseFilter(content: string, expression: string): Segment {
  // content looks like: @.path <op> <literal>
  const body = content.trim();
  if (!body.startsWith('@')) {
    throw new Error(`transform.json: filter must reference '@' in expression '${expression}'`);
  }
  for (const op of COMPARISON_OPERATORS) {
    const idx = body.indexOf(op);
    if (idx === -1) continue;
    const left = body.slice(0, idx).trim();
    const right = body.slice(idx + op.length).trim();
    // left is '@' optionally followed by .a.b — strip the leading '@.'
    const path = left.replace(/^@\.?/, '');
    const segments = path === '' ? [] : path.split('.');
    return { kind: 'filter', path: segments, op, value: parsePrimitive(right, expression) };
  }
  throw new Error(`transform.json: filter needs a comparison operator in expression '${expression}'`);
}

/** Finds the index of the `]` that closes the `[` at `open`, respecting quotes. */
function findClosingBracket(expr: string, open: number): number {
  let quote: string | null = null;
  for (let i = open + 1; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === ']') {
      return i;
    }
  }
  throw new Error(`transform.json: unbalanced '[' in expression '${expr}'`);
}

function parseBracket(inner: string, expression: string): Segment {
  const token = inner.trim();
  if (token === '*') return { kind: 'wildcard' };
  if (token.startsWith('?')) {
    const filterBody = token.slice(1).trim();
    if (!filterBody.startsWith('(') || !filterBody.endsWith(')')) {
      throw new Error(`transform.json: malformed filter '[${inner}]' in expression '${expression}'`);
    }
    return parseFilter(filterBody.slice(1, -1), expression);
  }
  if (
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'))
  ) {
    return { kind: 'member', name: token.slice(1, -1) };
  }
  if (/^-?\d+$/.test(token)) {
    return { kind: 'index', index: Number(token) };
  }
  throw new Error(`transform.json: unsupported bracket '[${inner}]' in expression '${expression}'`);
}

function parseExpression(expression: string): Segment[] {
  const expr = expression.trim();
  if (expr[0] !== '$') {
    throw new Error(`transform.json: JSONPath expression must start with '$': '${expression}'`);
  }
  const segments: Segment[] = [];
  let i = 1;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '.') {
      i++;
      if (expr[i] === '*') {
        segments.push({ kind: 'wildcard' });
        i++;
        continue;
      }
      let name = '';
      while (i < expr.length && /[\w$]/.test(expr[i])) {
        name += expr[i];
        i++;
      }
      if (name === '') {
        throw new Error(`transform.json: invalid member access in expression '${expression}'`);
      }
      segments.push({ kind: 'member', name });
    } else if (ch === '[') {
      const close = findClosingBracket(expr, i);
      segments.push(parseBracket(expr.slice(i + 1, close), expression));
      i = close + 1;
    } else {
      throw new Error(`transform.json: unexpected character '${ch}' in expression '${expression}'`);
    }
  }
  return segments;
}

function compare(actual: unknown, op: ComparisonOperator, expected: Primitive): boolean {
  switch (op) {
    case '===':
      return actual === expected;
    case '!==':
      return actual !== expected;
    // Loose equality without the `==` operator: equal when strictly equal or
    // when their string forms match (bridges e.g. number 5 and string "5").
    case '==':
      return actual === expected || String(actual) === String(expected);
    case '!=':
      return !(actual === expected || String(actual) === String(expected));
    default: {
      // Ordering comparisons only make sense for numbers/strings.
      if (
        (typeof actual === 'number' && typeof expected === 'number') ||
        (typeof actual === 'string' && typeof expected === 'string')
      ) {
        if (op === '>') return actual > expected;
        if (op === '>=') return actual >= expected;
        if (op === '<') return actual < expected;
        return actual <= expected;
      }
      return false;
    }
  }
}

function applySegment(node: unknown, seg: Segment, out: unknown[]): void {
  switch (seg.kind) {
    case 'member':
      if (isRecord(node) && seg.name in node) out.push(node[seg.name]);
      break;
    case 'index':
      if (Array.isArray(node)) {
        const idx = seg.index < 0 ? node.length + seg.index : seg.index;
        if (idx >= 0 && idx < node.length) out.push(node[idx]);
      }
      break;
    case 'wildcard':
      if (Array.isArray(node)) out.push(...node);
      else if (isRecord(node)) out.push(...Object.values(node));
      break;
    case 'filter':
      if (Array.isArray(node)) {
        for (const element of node) {
          if (compare(getByPath(element, seg.path), seg.op, seg.value)) out.push(element);
        }
      }
      break;
  }
}

/**
 * Evaluates a JSONPath `expression` against `data`, returning every matched
 * value as an array (empty when nothing matches).
 */
export function queryJsonPath(data: unknown, expression: string): unknown[] {
  const segments = parseExpression(expression);
  let current: unknown[] = [data];
  for (const seg of segments) {
    const next: unknown[] = [];
    for (const node of current) {
      applySegment(node, seg, next);
    }
    current = next;
  }
  return current;
}
