import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";

import { isFrameElement } from "@excalidraw/element";
import type { ExcalidrawElement, ExcalidrawFrameElement } from "@excalidraw/element/types";

import { exportToSvg } from "../scene/export";

import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawAppState } from "./App";
import { DotsHorizontalIcon, DotsIcon, PlusIcon, playerPlayIcon, slidesLayoutIcon } from "./icons";
import { ScrollableList } from "./ScrollableList";
import { ToolButton } from "./ToolButton";

import "./PresentationSidebar.scss";

const FrameThumbnail = ({ frame }: { frame: ExcalidrawFrameElement }) => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void exportToSvg(
      app.scene.getNonDeletedElements(),
      {
        exportBackground: false,
        viewBackgroundColor: appState.viewBackgroundColor,
        frameRendering: {
          enabled: true,
          clip: true,
          outline: false,
          name: false,
        },
      },
      app.files,
      {
        exportingFrame: frame,
        renderEmbeddables: false,
        skipInliningFonts: true,
      },
    )
      .then((svg) => {
        if (cancelled) {
          return;
        }

        svg.querySelector(".style-fonts")?.remove();
        setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [app, app.files, appState.viewBackgroundColor, frame]);

  return (
    <div
      className="PresentationSidebar__preview"
      aria-hidden
      style={
        src
          ? {
              backgroundImage: `url("${src}")`,
            }
          : undefined
      }
    />
  );
};

export const PresentationSidebar = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const frames = app.getPresentationFrames();
  const [draggedId, setDraggedId] = useState<ExcalidrawElement["id"] | null>(null);

  const activeFrameId = useMemo(() => {
    if (appState.presentationModeEnabled && appState.presentationFrameId) {
      return appState.presentationFrameId;
    }

    const selectedFrameId = Object.keys(appState.selectedElementIds).find((id) => {
      const element = app.scene.getNonDeletedElementsMap().get(id);
      return !!element && isFrameElement(element);
    });

    return selectedFrameId ?? frames[0]?.id ?? null;
  }, [
    app,
    appState.presentationFrameId,
    appState.presentationModeEnabled,
    appState.selectedElementIds,
    frames,
  ]);

  const reorderSlides = (targetId: ExcalidrawElement["id"]) => {
    if (!draggedId || draggedId === targetId) {
      return;
    }

    const ids = frames.map((frame) => frame.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    ids.splice(toIndex, 0, ...ids.splice(fromIndex, 1));
    app.reorderPresentationFrames(ids);
  };

  return (
    <div className="PresentationSidebar">
      <div className="PresentationSidebar__header">
        <div className="PresentationSidebar__heading">
          <div className="PresentationSidebar__title">Presentation</div>
        </div>
        <div className="PresentationSidebar__actions">
          <ToolButton
            type="button"
            size="small"
            className="PresentationSidebar__actionButton"
            icon={slidesLayoutIcon}
            aria-label="Slides layout"
            title="Slides layout"
            onClick={() => app.setOpenDialog({ name: "slidesLayout" })}
          />
          <ToolButton
            type="button"
            size="small"
            className="PresentationSidebar__actionButton"
            icon={PlusIcon}
            aria-label="Add slide action"
            title="Add slide action"
          />
          <ToolButton
            type="button"
            size="small"
            className="PresentationSidebar__actionButton"
            icon={DotsIcon}
            aria-label="Presentation actions"
            title="Presentation actions"
          />
        </div>
      </div>

      <ScrollableList className="PresentationSidebar__slides" placeholder="">
        <div className="PresentationSidebar__slidesHeader">
          <div className="PresentationSidebar__slidesTitle">Slides ({frames.length})</div>
        </div>
        {frames.map((frame, index) => (
          <div
            key={frame.id}
            role="button"
            tabIndex={0}
            draggable
            data-testid="presentation-slide"
            className={clsx("PresentationSidebar__slide", {
              "PresentationSidebar__slide--active": activeFrameId === frame.id,
            })}
            onClick={() => app.goToPresentationFrame(frame.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                app.goToPresentationFrame(frame.id);
              }
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", frame.id);
              setDraggedId(frame.id);
            }}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              reorderSlides(frame.id);
              setDraggedId(null);
            }}
          >
            <div className="PresentationSidebar__checkboxWrapper">
              <label className="PresentationSidebar__checkboxLabel" aria-hidden>
                <input
                  className="PresentationSidebar__checkboxInput"
                  type="checkbox"
                  tabIndex={-1}
                />
                <span className="PresentationSidebar__checkbox" />
                <span className="PresentationSidebar__checkboxSpacer" />
              </label>
            </div>
            <div className="PresentationSidebar__slideActionWrapper">
              <ToolButton
                type="button"
                size="small"
                className="PresentationSidebar__slideAction"
                icon={DotsHorizontalIcon}
                aria-label="Slide actions"
                title="Slide actions"
              />
            </div>
            <div className="PresentationSidebar__thumbnail">
              <FrameThumbnail frame={frame} />
            </div>
            <div className="PresentationSidebar__slideLabel">Slide {index + 1}</div>
          </div>
        ))}
      </ScrollableList>

      <div className="PresentationSidebar__footer">
        <FilledButton
          fullWidth
          className="PresentationSidebar__startButton"
          icon={playerPlayIcon}
          onClick={() => activeFrameId && app.startPresentation(activeFrameId)}
          disabled={!activeFrameId}
        >
          Start presentation
        </FilledButton>
      </div>
    </div>
  );
};
