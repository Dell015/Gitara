import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource-variable/montserrat";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import App from "./App";

// Offline support: the service worker caches the app so it opens without internet.
// Registered only in production builds, so it never gets in the way of development.
if (import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
