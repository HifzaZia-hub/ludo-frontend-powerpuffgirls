import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LgsAdapter } from "@/adapter/LgsAdapter";
import { App } from "@/App";
import { createGameStore } from "@/store/gameStore";
import "@/styles/theme.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error('index.html is missing <div id="root">');
}

const serverUrl = import.meta.env.VITE_SERVER_URL;
if (!serverUrl) {
  throw new Error("VITE_SERVER_URL is not set. Copy .env.example to .env and restart.");
}

// NFR-SYS-12: the one place that knows which adapter is in use.
const store = createGameStore(new LgsAdapter(serverUrl));

createRoot(rootElement).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
