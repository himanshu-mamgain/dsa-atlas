import { Component, type ErrorInfo, type ReactNode } from "react";
import { Copy, ListChecks, RotateCcw, TriangleAlert } from "lucide-react";
import { isMissingFileError, reloadForNewVersion } from "../pwa";

/**
 * Catches a crash while drawing one page, so the rest of the app (the app bar, the tabs)
 * keeps working and you see what went wrong instead of a blank screen. App.tsx keys it by
 * the address, so opening another page starts fresh.
 */
export class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // An old version asking for files a deploy removed: load the new version instead.
    if (isMissingFileError(error) && reloadForNewVersion()) return;
    console.error("DSA Atlas: this page crashed", error, info.componentStack);
  }

  private details() {
    const e = this.state.error;
    return `${location.href}\n${e?.name}: ${e?.message}\n${(e?.stack ?? "").split("\n").slice(0, 6).join("\n")}`;
  }

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="page page-crash" role="alert">
        <h1>
          <TriangleAlert size={22} aria-hidden /> This page couldn't open
        </h1>
        <p className="muted">
          {isMissingFileError(error)
            ? "A newer version of DSA Atlas is out and part of this page has moved. Reload to get it. Your saved work is safe."
            : "Something in it failed to load. Your saved work is safe. Try again, or go back to the checklist."}
        </p>
        <pre className="page-crash-error">{`${error.name}: ${error.message}`}</pre>
        <div className="page-crash-actions">
          <button type="button" className="btn primary" onClick={() => (isMissingFileError(error) ? location.reload() : this.setState({ error: null }))}>
            <RotateCcw size={16} aria-hidden /> {isMissingFileError(error) ? "Reload" : "Try again"}
          </button>
          <a className="btn" href="?page=checklist">
            <ListChecks size={16} aria-hidden /> Back to the checklist
          </a>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void navigator.clipboard?.writeText(this.details()).then(() => this.setState({ copied: true }), () => undefined)}
          >
            <Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy error details"}
          </button>
        </div>
      </div>
    );
  }
}
