import { lazy, StrictMode, Suspense } from "react";
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

// The DEV check on the import keeps the kitchen sink out of the production bundle.
const KitchenSink = import.meta.env.DEV
  ? lazy(() =>
      import("@/screens/KitchenSink").then(({ KitchenSink }) => ({ default: KitchenSink })),
    )
  : null;
const query = new URLSearchParams(window.location.search);
const showKitchenSink = query.get("kitchen") === "1";

// The DEV check keeps the fixtures out of the production bundle too.
const fixtureName = query.get("fixture");
if (import.meta.env.DEV && fixtureName !== null) {
  void import("@/mock/fixtures").then(({ showFixture }) => showFixture(fixtureName, store));
}

createRoot(rootElement).render(
  <StrictMode>
    {KitchenSink && showKitchenSink ? (
      <Suspense>
        <KitchenSink />
      </Suspense>
    ) : (
      <App store={store} />
    )}
  </StrictMode>,
);
