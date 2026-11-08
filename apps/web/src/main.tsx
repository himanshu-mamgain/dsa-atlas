import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { App } from "./App";
import { registerServiceWorker } from "./pwa";
import { startReminderSync } from "./push/push";
import { requestPersistentStorage } from "./storage";
import "./theme";
import "./styles.css";

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
