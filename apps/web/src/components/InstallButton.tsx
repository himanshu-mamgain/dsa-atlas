import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { getInstallKind, promptInstall, subscribeInstall } from "../install";

/**
 * "Install" in the app bar while the app can be installed, as in Structura.
 * Chrome, Edge and Samsung Internet show their own install dialog; on iPhone and
 * iPad there's none, so it explains Share → Add to Home Screen instead.
 */
export function InstallButton() {
  const kind = useSyncExternalStore(subscribeInstall, getInstallKind);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (!help) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHelp(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help]);

  if (kind === "installed" || kind === "unavailable") return null;

  return (
    <div className="appbar-install">
      <button
        type="button"
        className="btn primary appbar-install-btn"
        onClick={() => (kind === "ios" ? setHelp(!help) : void promptInstall())}
        aria-expanded={kind === "ios" ? help : undefined}
        aria-label="Install the app"
        title="Install the app: opens full screen, works offline"
      >
        <Download size={18} aria-hidden />
        <span className="appbar-install-label">Install</span>
      </button>
      {help && (
        <>
          <div className="install-scrim" onClick={() => setHelp(false)} />
          <div className="card install-popover" role="dialog" aria-label="Install on iPhone or iPad">
            <button type="button" className="btn icon ghost install-popover-close" onClick={() => setHelp(false)} aria-label="Close">
              <X size={16} />
            </button>
            <strong>Install DSA Atlas</strong>
            <ol>
              <li>
                In Safari, tap <Share size={15} aria-label="Share" /> <b>Share</b>.
              </li>
              <li>
                Choose <SquarePlus size={15} aria-hidden /> <b>Add to Home Screen</b>.
              </li>
              <li>Open DSA Atlas from your Home Screen.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
