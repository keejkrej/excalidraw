import { t } from "@excalidraw/excalidraw/i18n";
import React from "react";

type DesktopErrorBoundaryState = {
  hasError: boolean;
};

export class DesktopErrorBoundary extends React.Component<
  React.PropsWithChildren,
  DesktopErrorBoundaryState
> {
  state: DesktopErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="ErrorSplash excalidraw">
        <div className="ErrorSplash-messageContainer">
          <div className="ErrorSplash-paragraph bigger align-center">
            {t("errorSplash.headingMain")}
          </div>
          <div className="ErrorSplash-paragraph align-center">
            <button onClick={() => window.location.reload()}>Reload app</button>
          </div>
          <div className="ErrorSplash-paragraph align-center">
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                  window.location.reload();
                } catch (error) {
                  console.error(error);
                }
              }}
            >
              {t("errorSplash.clearCanvasMessage")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
