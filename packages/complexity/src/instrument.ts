/**
 * Rewrites a JavaScript solution so it counts its own steps: one for every loop
 * pass and every function call, plus the length of anything spread (`...arr`)
 * or handed to `new Set(…)`/`new Map(…)`. Built-ins such as sort and slice are
 * charged separately by the runner (see `chargeBuiltins`). Counting steps
 * instead of milliseconds gives the same answer every run: caches, garbage
 * collection and the JIT change the time, never the count.
 */
import { parse } from "acorn";
import { generate } from "astring";

type Node = { type: string; [key: string]: unknown };

const LOOPS = new Set(["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"]);
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

const id = (name: string): Node => ({ type: "Identifier", name });
const step = (counter: string): Node => ({
  type: "ExpressionStatement",
  expression: { type: "UpdateExpression", operator: "++", prefix: false, argument: { type: "MemberExpression", object: id(counter), property: id("n"), computed: false, optional: false } },
});
const call = (fn: string, arg: Node): Node => ({ type: "CallExpression", callee: id(fn), arguments: [arg], optional: false });

function block(body: Node, counter: string): Node {
  if (body.type === "BlockStatement") return { ...body, body: [step(counter), ...(body.body as Node[])] };
  return { type: "BlockStatement", body: [step(counter), body] };
}

function visit(node: Node, counter: string, spread: string) {
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) v.forEach((x) => x && typeof x === "object" && "type" in x && visit(x as Node, counter, spread));
    else if (v && typeof v === "object" && "type" in v) visit(v as Node, counter, spread);
  }
  if (LOOPS.has(node.type)) node.body = block(node.body as Node, counter);
  else if (FUNCTIONS.has(node.type)) {
    const body = node.body as Node;
    if (body.type === "BlockStatement") node.body = block(body, counter);
    else {
      node.body = { type: "BlockStatement", body: [step(counter), { type: "ReturnStatement", argument: body }] };
      node.expression = false;
    }
  } else if (node.type === "SpreadElement") node.argument = call(spread, node.argument as Node);
  else if (node.type === "NewExpression") {
    const callee = node.callee as Node;
    const args = node.arguments as Node[];
    if (callee.type === "Identifier" && /^(Set|Map|WeakSet|WeakMap)$/.test(callee.name as string) && args.length && args[0].type !== "SpreadElement") args[0] = call(spread, args[0]);
  }
}

/**
 * The instrumented code. It expects `counter` ({ n: number }) and `spread`
 * (a function that adds its argument's length to the count and returns it)
 * to be in scope. Throws a SyntaxError when the code isn't JavaScript.
 */
export function instrument(code: string, counter = "__steps", spread = "__spread"): string {
  const ast = parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true, allowHashBang: true }) as unknown as Node;
  visit(ast, counter, spread);
  return generate(ast as never);
}

// Captured before any patching, so charging never charges itself.
const keysOf = Object.keys;

/** Size of a value for charging work: length, size, or number of keys. */
export function sizeOf(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "string" || Array.isArray(v)) return v.length;
  if (v instanceof Set || v instanceof Map) return v.size;
  if (typeof v === "object") {
    const len = (v as { length?: unknown }).length;
    return typeof len === "number" ? len : keysOf(v).length;
  }
  return 0;
}

type Patch = [target: object, name: string, cost: (self: unknown, args: unknown[], result: unknown) => number];

const linear = (self: unknown) => sizeOf(self);
const total = (self: unknown, args: unknown[]) => {
  let n = sizeOf(self);
  for (let i = 0; i < args.length; i++) n += sizeOf(args[i]);
  return n;
};
const nlogn = (self: unknown) => {
  const n = sizeOf(self);
  return n > 1 ? Math.ceil(n * Math.log2(n)) : n;
};

/** Built-ins whose work grows with their input, and what each call costs in steps. */
function patches(): Patch[] {
  const A = Array.prototype;
  const S = String.prototype;
  const list: Patch[] = [];
  for (const name of ["indexOf", "lastIndexOf", "includes", "slice", "join", "reverse", "fill", "splice", "shift", "unshift", "flat", "flatMap", "map", "filter", "forEach", "reduce", "reduceRight", "some", "every", "find", "findIndex", "findLast", "findLastIndex", "toReversed", "toSpliced", "with"])
    if (name in A) list.push([A, name, linear]);
  list.push([A, "concat", total]);
  // With a comparator the comparisons count themselves (they're calls to your function).
  for (const name of ["sort", "toSorted"]) if (name in A) list.push([A, name, (self, args) => (typeof args[0] === "function" ? 0 : nlogn(self))]);
  for (const name of ["split", "slice", "substring", "substr", "indexOf", "lastIndexOf", "includes", "replace", "replaceAll", "toLowerCase", "toUpperCase", "trim", "trimStart", "trimEnd", "match", "matchAll", "search", "normalize", "localeCompare"])
    if (name in S) list.push([S, name, linear]);
  for (const name of ["repeat", "padStart", "padEnd"]) list.push([S, name, (_s, _a, result) => sizeOf(result)]);
  for (const name of ["startsWith", "endsWith"]) list.push([S, name, (_s, args) => sizeOf(args[0])]);
  list.push([S, "concat", total]);
  list.push([Array, "from", (_s, args) => sizeOf(args[0])]);
  for (const name of ["keys", "values", "entries", "assign"]) list.push([Object, name, (_s, args) => sizeOf(args[0]) + sizeOf(args[1])]);
  list.push([JSON, "stringify", (_s, _a, result) => sizeOf(result)]);
  list.push([JSON, "parse", (_s, args) => sizeOf(args[0])]);
  for (const name of ["max", "min"]) list.push([Math, name, (_s, args) => args.length]);
  return list;
}

/**
 * Charges built-in work to `counter` until the returned function is called.
 * Only for the counting run: the timed runs use the real built-ins.
 */
export function chargeBuiltins(counter: { n: number }): () => void {
  const undo: (() => void)[] = [];
  for (const [target, name, cost] of patches()) {
    const t = target as Record<string, unknown>;
    const original = t[name] as (...a: unknown[]) => unknown;
    if (typeof original !== "function") continue;
    const wrapped = function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      counter.n += cost(this, args, result);
      return result;
    };
    Object.defineProperty(t, name, { value: wrapped, writable: true, configurable: true, enumerable: false });
    undo.push(() => Object.defineProperty(t, name, { value: original, writable: true, configurable: true, enumerable: false }));
  }
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]();
  };
}
