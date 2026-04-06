import { DEFAULT_SIDEBAR, PRESENTATION_SIDEBAR_TAB } from "@excalidraw/common";
import {
  Button,
  Footer,
  FooterLeft,
  useExcalidrawAPI,
  useExcalidrawStateValue,
} from "@excalidraw/excalidraw/index";
import { presentationIcon } from "@excalidraw/excalidraw/components/icons";
import React from "react";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import "./AppFooter.scss";

const PresentationSidebarToggle = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const openSidebar = useExcalidrawStateValue("openSidebar");
  const isPresentationSidebarOpen =
    openSidebar?.name === DEFAULT_SIDEBAR.name && openSidebar?.tab === PRESENTATION_SIDEBAR_TAB;

  return (
    <Button
      type="button"
      aria-label="Toggle presentation sidebar"
      title="Toggle presentation sidebar"
      className={`presi-sidebar-button${isPresentationSidebarOpen ? " active" : ""}`}
      onSelect={() =>
        excalidrawAPI?.toggleSidebar({
          name: DEFAULT_SIDEBAR.name,
          tab: PRESENTATION_SIDEBAR_TAB,
        })
      }
    >
      <span className="presi-sidebar-button__content" aria-hidden="true">
        {presentationIcon}
      </span>
    </Button>
  );
};

export const AppFooter = React.memo(({ onChange }: { onChange: () => void }) => {
  return (
    <>
      <FooterLeft>
        <PresentationSidebarToggle />
      </FooterLeft>
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
        </div>
      </Footer>
    </>
  );
});
