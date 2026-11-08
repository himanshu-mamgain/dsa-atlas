/**
 * Monaco bundled locally (not from a CDN) so the editor works offline, and
 * trimmed to the editor features plus the languages DSA Atlas supports.
 * Only the base editor worker is used: we need highlighting, not language servers.
 */
import * as monaco from "monaco-esm/editor/editor.api.js";
import "./monaco-features";
import EditorWorker from "monaco-esm/editor/editor.worker.js?worker";
import { loader } from "@monaco-editor/react";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

monaco.editor.defineTheme("atlas-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#0f1522",
    "editor.lineHighlightBackground": "#161e30",
    "editorGutter.background": "#0f1522",
  },
});

export { monaco };
