// Reads one of your Notion problem pages (Pattern line, ## Problem, ## Solution
// with ### approaches, ## Dry Run, ## Edge Cases, …) into the parts the solve
// page shows: the statement and its examples, the reference solutions from
// brute force to optimal, and everything else as notes to open when stuck.
import { extractExamples, type Example } from "@dsa-atlas/complexity";
import type { ApproachKind, Block, Rich } from "@dsa-atlas/shared";

export interface NoteMetaLine {
  pattern?: string;
  difficulty?: string;
  /** "LeetCode 206", "GfG Recursion Track"… */
  source?: string;
  leetcode?: number;
  blind75?: boolean;
}

export interface RefSolution {
  title: string;
  kind: ApproachKind;
  code: string;
  lang: string;
  /** From the "// Time: O(n)   Space: O(1)" comment, or the text around it. */
  time?: string;
  space?: string;
  /** What the notes say about this solution. */
  notes: Block[];
}

export interface Section {
  title: string;
  blocks: Block[];
}

export interface ParsedProblem {
  meta: NoteMetaLine;
  statement: Block[];
  examples: Example[];
  solutions: RefSolution[];
  /** The other sections (Core Insight, Dry Run, Edge Cases…), in page order. */
  sections: Section[];
}

export const plain = (r: Rich[]) => r.map(([t]) => t).join("");

/** "⚠️ Critical Mistakes" → "Critical Mistakes". */
const cleanTitle = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

function blockText(b: Block): string {
  switch (b.t) {
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "quote":
    case "toggle":
    case "callout":
      return plain(b.r) + (("c" in b && b.c) ? "\n" + b.c.map(blockText).join("\n") : "");
    case "ul":
    case "ol":
    case "todo":
      return b.items.map((i) => plain(i.r)).join("\n");
    case "code":
      return b.text;
    default:
      return "";
  }
}

function readMeta(text: string): NoteMetaLine | null {
  if (!/pattern\s*:|difficulty\s*:/i.test(text)) return null;
  const meta: NoteMetaLine = {};
  for (const part of text.split("|").map((p) => p.trim())) {
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^pattern\s*:\s*(.+)$/i))) meta.pattern = m[1].trim();
    else if ((m = part.match(/^difficulty\s*:\s*(\w+)/i))) meta.difficulty = m[1];
    else if ((m = part.match(/^blind\s*75\s*:\s*(\w+)/i))) meta.blind75 = /^y/i.test(m[1]);
    else if ((m = part.match(/^leet\s*code\s*#?\s*(\d+)/i))) {
      meta.leetcode = Number(m[1]);
      meta.source = `LeetCode ${m[1]}`;
    } else if (part && !meta.source) meta.source = part;
  }
  return meta;
}

/** The first O(…) after "Time" (or "Space"), with nested brackets: O(max(n, m)). */
export function bigOAfter(text: string, label: "Time" | "Space"): string | undefined {
  const re = new RegExp(`\\b${label}(?:\\s+complexity)?\\s*[:=–-]?\\s*(?=O\\s*\\()`, "i");
  const m = re.exec(text);
  if (!m) return undefined;
  let i = m.index + m[0].length;
  const start = i;
  while (i < text.length && text[i] !== "(") i++;
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return text.slice(start, i + 1).replace(/\s+/g, " ");
  }
  return undefined;
}

function kindOf(title: string): ApproachKind | null {
  if (/brute|naive/i.test(title)) return "brute";
  if (/optimal|best|✅/i.test(title)) return "optimal";
  if (/better|improved/i.test(title)) return "better";
  return null;
}

const KIND_ORDER: Record<ApproachKind, number> = { brute: 0, better: 1, optimal: 2 };

/** Splits a solution section on ### headings: each one with its code is a solution. */
function readSolutions(blocks: Block[]): RefSolution[] {
  const out: (RefSolution & { known: boolean })[] = [];
  let current: (RefSolution & { known: boolean }) | null = null;
  const start = (title: string) => {
    const kind = kindOf(title);
    current = { title, kind: kind ?? "better", known: kind !== null, code: "", lang: "", notes: [] };
    out.push(current);
  };
  for (const b of blocks) {
    if (b.t === "h3") {
      start(cleanTitle(plain(b.r)));
      if (b.c) for (const c of b.c) add(c);
      continue;
    }
    add(b);
  }
  function add(b: Block) {
    if (b.t === "hr") return;
    if (b.t === "code" && !/^(plain ?text|text|markdown)$/i.test(b.lang)) {
      if (!current) start(`Solution ${out.length + 1}`);
      if (!current!.code) {
        current!.code = b.text;
        current!.lang = b.lang;
        return;
      }
    }
    if (current) current.notes.push(b);
  }
  const solutions = out.filter((s) => s.code);
  for (const s of solutions) {
    const text = [s.code, ...s.notes.map(blockText)].join("\n");
    s.time = bigOAfter(text, "Time");
    s.space = bigOAfter(text, "Space");
  }
  // One solution with no label is the answer.
  if (solutions.length === 1 && !solutions[0].known) solutions[0].kind = "optimal";
  return solutions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => KIND_ORDER[a.s.kind] - KIND_ORDER[b.s.kind] || a.i - b.i)
    .map(({ s: { known: _known, ...s } }) => s);
}

const PROBLEM = /^(problem|question|statement|description|task)\b/i;
const SOLUTION = /^(solutions?|approach(es)?|code|implementation)\b|brute|optimal/i;

export function parseProblem(blocks: Block[]): ParsedProblem {
  let meta: NoteMetaLine = {};
  const intro: Block[] = [];
  const groups: Section[] = [];
  for (const b of blocks) {
    if (b.t === "h2" || b.t === "h1") {
      groups.push({ title: cleanTitle(plain(b.r)), blocks: b.c ? [...b.c] : [] });
      continue;
    }
    if (b.t === "hr") continue;
    if (!groups.length) {
      const m = b.t === "p" && !Object.keys(meta).length ? readMeta(plain(b.r)) : null;
      if (m) meta = m;
      else intro.push(b);
    } else groups[groups.length - 1].blocks.push(b);
  }
  const problem = groups.find((g) => PROBLEM.test(g.title));
  const solutionGroups = groups.filter((g) => g !== problem && SOLUTION.test(g.title));
  const statement = problem ? [...intro, ...problem.blocks] : intro;
  const examples = extractExamples(statement.map(blockText).join("\n\n"));
  // Some pages put each approach under its own ## heading.
  const solutionBlocks = solutionGroups.flatMap((g) => (/^(solutions?|approach(es)?|code|implementation)\b/i.test(g.title) ? g.blocks : [{ t: "h3", r: [[g.title]] } as Block, ...g.blocks]));
  return {
    meta,
    statement,
    examples,
    solutions: readSolutions(solutionBlocks),
    sections: groups.filter((g) => g !== problem && !solutionGroups.includes(g)),
  };
}
