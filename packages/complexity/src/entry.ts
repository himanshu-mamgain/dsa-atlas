/**
 * Finds the function to call in a solution: the top-level function (or
 * `class Solution` method) that nothing else calls and that takes as many
 * arguments as the example has. Helpers such as `isPalindromeHelper` or `dfs`
 * are called by it, so they're skipped.
 */

export interface Entry {
  name: string;
  params: string[];
  /** Set for a method of `class Solution`, called as new Solution().name(...). */
  className?: string;
}

interface Decl extends Entry {
  start: number;
  end: number;
}

/** Blanks out comments and the inside of strings, keeping every offset in place. */
export function mask(code: string): string {
  const out = code.split("");
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const stop = end < 0 ? code.length : end;
      blank(i, stop);
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? code.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === "\\") j++;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
    } else i++;
  }
  return out.join("");
}

function matching(s: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const want = pairs[s[open]];
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === s[open]) depth++;
    else if (s[i] === want && --depth === 0) return i;
  }
  return s.length - 1;
}

function depthAt(s: string): Int32Array {
  const d = new Int32Array(s.length + 1);
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    d[i] = depth;
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth = Math.max(0, depth - 1);
  }
  d[s.length] = depth;
  return d;
}

function paramsOf(s: string, open: number): { params: string[]; close: number } {
  const close = matching(s, open);
  const inner = s.slice(open + 1, close);
  const params: string[] = [];
  let depth = 0;
  let start = 0;
  const push = (p: string) => {
    const t = p.trim();
    if (!t) return;
    const m = t.replace(/^\.\.\./, "").match(/^[A-Za-z_$][\w$]*/);
    params.push(m ? m[0] : `arg${params.length}`);
  };
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      push(inner.slice(start, i));
      start = i + 1;
    }
  }
  push(inner.slice(start));
  return { params, close };
}

/** End of a body that starts at or after `from`: its closing brace, or the end of the line for `x => expr`. */
function bodyEnd(s: string, from: number): number {
  let i = from;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] === "{") return matching(s, i);
  const nl = s.indexOf("\n", i);
  return nl < 0 ? s.length : nl;
}

function declarations(code: string): Decl[] {
  const s = mask(code);
  const depth = depthAt(s);
  const decls: Decl[] = [];
  let m: RegExpExecArray | null;

  const fn = /\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fn.exec(s))) {
    if (depth[m.index] !== 0) continue;
    const { params, close } = paramsOf(s, m.index + m[0].length - 1);
    decls.push({ name: m[1], params, start: m.index, end: bodyEnd(s, close + 1) });
  }

  const bound = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(function\b\s*\*?\s*[\w$]*\s*\(|\(|([A-Za-z_$][\w$]*)\s*=>)/g;
  while ((m = bound.exec(s))) {
    if (depth[m.index] !== 0) continue;
    if (m[3]) {
      decls.push({ name: m[1], params: [m[3]], start: m.index, end: bodyEnd(s, m.index + m[0].length) });
      continue;
    }
    const { params, close } = paramsOf(s, m.index + m[0].length - 1);
    const rest = s.slice(close + 1).match(/^\s*=>/);
    if (!m[2].startsWith("function") && !rest) continue; // `const x = (a + b)` isn't a function
    decls.push({ name: m[1], params, start: m.index, end: bodyEnd(s, close + 1 + (rest ? rest[0].length : 0)) });
  }

  const cls = /\bclass\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
  while ((m = cls.exec(s))) {
    if (depth[m.index] !== 0 || m[1] !== "Solution") continue;
    const open = m.index + m[0].length - 1;
    const close = matching(s, open);
    const body = s.slice(open + 1, close);
    const method = /(^|[\s;}])(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/g;
    let mm: RegExpExecArray | null;
    while ((mm = method.exec(body))) {
      const at = open + 1 + mm.index + mm[1].length;
      if (depth[at] !== 1 || ["constructor", "if", "for", "while", "switch", "catch", "function", "return"].includes(mm[2])) continue;
      const { params, close: pc } = paramsOf(s, open + 1 + mm.index + mm[0].length - 1);
      decls.push({ name: mm[2], params, className: "Solution", start: at, end: bodyEnd(s, pc + 1) });
    }
  }
  return decls.sort((a, b) => a.start - b.start);
}

/** Top-level functions and Solution methods that no other function calls. */
export function findEntries(code: string): Entry[] {
  const s = mask(code);
  const decls = declarations(code).filter((d) => !/^(ListNode|TreeNode|Node)$/.test(d.name));
  const called = (d: Decl) =>
    decls.some((o) => o !== d && new RegExp(`(?<![\\w$.])${d.name.replace(/\$/g, "\\$")}\\s*\\(|this\\.${d.name}\\s*\\(`).test(s.slice(o.start, o.end + 1)));
  return decls.filter((d) => !called(d)).map(({ name, params, className }) => ({ name, params, className }));
}

/**
 * The function to measure: one taking `argCount` arguments, preferring `prefer`
 * (the name the notes use), then the last one defined.
 */
export function pickEntry(code: string, argCount: number, prefer?: string): Entry | null {
  const entries = findEntries(code);
  const fitting = entries.filter((e) => e.params.length === argCount);
  return fitting.find((e) => e.name === prefer) ?? fitting.at(-1) ?? null;
}

/** Whether the code defines this name itself (its own ListNode class, say). */
export function declares(code: string, name: string): boolean {
  const s = mask(code);
  return new RegExp(`\\b(?:class|function|const|let|var)\\s+${name}\\b`).test(s);
}

/** All top-level function names, for a starter template. */
export const functionNames = (code: string) => declarations(code).map((d) => d.name);
