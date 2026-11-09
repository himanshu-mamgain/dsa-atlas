import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { App } from "./App";
import { registerServiceWorker } from "./pwa";
import { startReminderSync } from "./push/push";
import { requestPersistentStorage } from "./storage";
import { syncChecklist } from "./db/checklist";
import "./theme";
import "./styles.css";
import "./layout.css";
import "./notes/notes.css";
// Last, so the Structura look wins.
import "./shell.css";

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
