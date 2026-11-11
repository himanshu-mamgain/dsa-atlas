// Formats code with Prettier, loaded only the first time you press Format.
// JavaScript and TypeScript (Babel's parsers cover both, so the big TypeScript
// plugin isn't needed); the other languages have no formatter that runs in the browser.
import type { Language } from "@dsa-atlas/shared";

export const canFormat = (lang: Language) => lang === "javascript" || lang === "typescript";

/** The formatted code; throws with Prettier's message (and line) if it can't parse it. */
export async function formatCode(code: string, lang: Language): Promise<string> {
  const [prettier, babel, estree] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/babel"), import("prettier/plugins/estree")]);
  return prettier.format(code, {
    parser: lang === "typescript" ? "babel-ts" : "babel",
    plugins: [babel, estree],
    printWidth: 100,
    tabWidth: 2,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
  });
}
