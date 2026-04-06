import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";

import { isFrameElement } from "@excalidraw/element";
import type { ExcalidrawElement, ExcalidrawFrameElement } from "@excalidraw/element/types";

import { exportToSvg } from "../scene/export";

import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawAppState } from "./App";
import { DotsIcon, PlusIcon, gridIcon, playerPlayIcon } from "./icons";
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

  return src ? <img src={src} alt="" draggable={false} /> : null;
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
        <div>
          <div className="PresentationSidebar__title">Presentation</div>
          <div className="PresentationSidebar__subtitle">Slides ({frames.length})</div>
        </div>
        <div className="PresentationSidebar__actions">
          <ToolButton
            type="button"
            size="small"
            icon={gridIcon}
            aria-label="Slides layout"
            title="Slides layout"
            onClick={() => app.setOpenDialog({ name: "slidesLayout" })}
          />
          <ToolButton
            type="button"
            size="small"
            icon={PlusIcon}
            aria-label="Add slide action"
            title="Add slide action"
            disabled
          />
          <ToolButton
            type="button"
            size="small"
            icon={DotsIcon}
            aria-label="Presentation actions"
            title="Presentation actions"
            disabled
          />
        </div>
      </div>

      <div className="PresentationSidebar__slides">
        {frames.map((frame, index) => (
          <div
            key={frame.id}
            role="button"
            tabIndex={0}
            draggable
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
            <div className="PresentationSidebar__slideToolbar">
              <span className="PresentationSidebar__checkbox" aria-hidden />
              <ToolButton
                type="button"
                size="small"
                icon={DotsIcon}
                aria-label="Slide actions"
                title="Slide actions"
                disabled
              />
            </div>
            <div className="PresentationSidebar__thumbnail">
              <FrameThumbnail frame={frame} />
            </div>
            <div className="PresentationSidebar__slideLabel">Slide {index + 1}</div>
          </div>
        ))}
      </div>

      <FilledButton
        fullWidth
        icon={playerPlayIcon}
        onClick={() => activeFrameId && app.startPresentation(activeFrameId)}
        disabled={!activeFrameId}
      >
        Start presentation
      </FilledButton>
    </div>
  );
};
