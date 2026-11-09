/**
 * Reads LeetCode-style examples out of a note ("Input: nums = [2,7,11,15], target = 9"
 * followed by "Output: [0,1]") into JavaScript values.
 */

export interface Example {
  /** The text after "Input:". */
  input: string;
  output?: string;
  args: Arg[];
}

export interface Arg {
  name?: string;
  value: unknown;
}

const INPUT = /^\s*input\s*:?\s*/i;
const OUTPUT = /^\s*output\s*:?\s*/i;
const STOP = /^\s*(explanation|note|constraints?|example)\b/i;

/** Every Input/Output pair in a block of text (a note's code block, usually). */
export function extractExamples(text: string): Example[] {
  const lines = text.split(/\r?\n/);
  const out: Example[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!INPUT.test(lines[i])) continue;
    let input = lines[i].replace(INPUT, "");
    let j = i + 1;
    // Multi-line inputs (grids) carry on until "Output".
    while (j < lines.length && !OUTPUT.test(lines[j]) && !INPUT.test(lines[j]) && !STOP.test(lines[j]) && lines[j].trim()) {
      input += " " + lines[j].trim();
      j++;
    }
    let output: string | undefined;
    if (j < lines.length && OUTPUT.test(lines[j])) {
      output = lines[j].replace(OUTPUT, "");
      j++;
      while (j < lines.length && lines[j].trim() && !INPUT.test(lines[j]) && !STOP.test(lines[j]) && /^[\s\[\]{}(),"'\d-]/.test(lines[j])) {
        output += " " + lines[j].trim();
        j++;
      }
      output = output.trim();
    }
    input = input.trim();
    if (input) out.push({ input, output, args: parseArgs(input) });
    i = j - 1;
  }
  return out;
}

/** Splits on commas that aren't inside brackets or quotes. */
export function splitTopLevel(s: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("[({".includes(ch)) depth++;
    else if ("])}".includes(ch)) depth--;
    else if (ch === sep && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** "nums = [1,2], k = 3" → two named args; "malayalam" → one string. */
export function parseArgs(input: string): Arg[] {
  const parts = splitTopLevel(input);
  const named = parts.map((p) => p.match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*)$/));
  if (!named.some(Boolean)) return [{ value: parseValue(input) }];
  const args: Arg[] = [];
  parts.forEach((p, i) => {
    const m = named[i];
    if (m) args.push({ name: m[1], value: parseValue(m[2]) });
    // A stray part without a name belongs to the value before it.
    else if (args.length) {
      const last = args[args.length - 1];
      last.value = parseValue(`${raw(last.value)}, ${p}`);
    }
  });
  return args;
}

const raw = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/** JSON, plus Python's None/True/False and single quotes; anything else is a string. */
export function parseValue(text: string): unknown {
  const s = text.trim().replace(/[.;]$/, "");
  const attempts = [s, s.replace(/\bNone\b/g, "null").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/'([^'\\]*)'/g, '"$1"')];
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      // Not JSON; try the next spelling.
    }
  }
  return s.replace(/^["'`]|["'`]$/g, "");
}
