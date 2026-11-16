import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { App } from "./App";
import { registerServiceWorker } from "./pwa";
import { initInstallPrompt } from "./install";
import { startReminderSync } from "./push/push";
import { requestPersistentStorage } from "./storage";
import { syncChecklist } from "./db/checklist";
import "./theme";
import "./styles.css";
import "./layout.css";
import "./notes/notes.css";
// Last, so the Structura look wins.
import "./shell.css";

// Before React renders: the browser can offer installation very early.
initInstallPrompt();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

registerServiceWorker();
startReminderSync();
requestPersistentStorage();
syncChecklist();
