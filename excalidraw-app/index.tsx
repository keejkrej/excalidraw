import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installDesktopRuntime } from "./desktop/runtime";

const bootstrap = async () => {
  await installDesktopRuntime();
  const { default: ExcalidrawApp } = await import("./App");

  window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
  const rootElement = document.getElementById("root")!;
  const root = createRoot(rootElement);

  root.render(
    <StrictMode>
      <ExcalidrawApp />
    </StrictMode>,
  );
};

void bootstrap();
