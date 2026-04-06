import clsx from "clsx";
import React, { useEffect, useState } from "react";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawAppState } from "./App";

import "./SlidesLayoutDialog.scss";

const LAYOUT_OPTIONS = [
  {
    value: "row",
    title: "Row",
    description: "Arrange slides horizontally in sidebar order.",
  },
  {
    value: "column",
    title: "Column",
    description: "Arrange slides vertically in sidebar order.",
  },
  {
    value: "grid",
    title: "Grid",
    description: "Arrange slides into a row-major grid in sidebar order.",
  },
] as const;

export const SlidesLayoutDialog = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const [layoutMode, setLayoutMode] = useState<(typeof LAYOUT_OPTIONS)[number]["value"]>("row");
  const [columnCount, setColumnCount] = useState(3);

  useEffect(() => {
    if (appState.openDialog?.name === "slidesLayout") {
      setLayoutMode("row");
      setColumnCount(3);
    }
  }, [appState.openDialog]);

  if (appState.openDialog?.name !== "slidesLayout") {
    return null;
  }

  return (
    <Dialog size="regular" title="Slides layout" onCloseRequest={() => app.setOpenDialog(null)}>
      <div className="SlidesLayoutDialog">
        <p className="SlidesLayoutDialog__intro">
          Reposition frames on the canvas without changing playback order. Frames are arranged in
          the same order they appear in the presentation sidebar.
        </p>
        <div className="SlidesLayoutDialog__options">
          {LAYOUT_OPTIONS.map((option) => {
            const selected = option.value === layoutMode;
            return (
              <button
                key={option.value}
                type="button"
                className={clsx("SlidesLayoutDialog__option", {
                  "SlidesLayoutDialog__option--selected": selected,
                })}
                onClick={() => setLayoutMode(option.value)}
              >
                <div className="SlidesLayoutDialog__optionPreview" aria-hidden />
                <div className="SlidesLayoutDialog__optionTitle">{option.title}</div>
                <div className="SlidesLayoutDialog__optionDescription">{option.description}</div>
              </button>
            );
          })}
        </div>

        <div className="SlidesLayoutDialog__field">
          <label htmlFor="slides-layout-columns" className="SlidesLayoutDialog__label">
            Column count
          </label>
          <select
            id="slides-layout-columns"
            className="SlidesLayoutDialog__select"
            value={columnCount}
            onChange={(event) => setColumnCount(Number(event.target.value))}
            disabled={layoutMode !== "grid"}
          >
            {Array.from({ length: 6 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="SlidesLayoutDialog__footer">
          <FilledButton color="muted" onClick={() => app.setOpenDialog(null)}>
            Close
          </FilledButton>
          <FilledButton
            onClick={() =>
              app.applyPresentationLayout({
                mode: layoutMode,
                columns: columnCount,
              })
            }
          >
            Apply layout
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};
