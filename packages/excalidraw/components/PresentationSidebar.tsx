import clsx from "clsx";
import React, { useEffect, useMemo, useState } from "react";

import { EXPORT_IMAGE_TYPES, arrayToMap } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  isFrameElement,
  newFrameElement,
  setPresentationOrder,
} from "@excalidraw/element";
import type { ExcalidrawElement, ExcalidrawFrameElement } from "@excalidraw/element/types";

import { actionDeleteSelected } from "../actions/actionDeleteSelected";
import { actionDuplicateSelection } from "../actions/actionDuplicateSelection";
import { prepareElementsForExport, saveAsJSON } from "../data";
import { getSelectedElements } from "../scene";
import { exportToSvg } from "../scene/export";

import { FilledButton } from "./FilledButton";
import { useApp, useExcalidrawAppState, useExcalidrawSetAppState } from "./App";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  copyIcon,
  DotsHorizontalIcon,
  DotsIcon,
  ExportIcon,
  PlusIcon,
  TrashIcon,
  pencilIcon,
  playerPlayIcon,
  pngIcon,
  saveAs,
  share as shareIcon,
  slidesLayoutIcon,
  svgIcon,
  tablerCheckIcon,
} from "./icons";
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
  const DEFAULT_PRESENTATION_FRAME = {
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  } as const;
  const app = useApp();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const frames = app.getPresentationFrames();
  const [draggedId, setDraggedId] = useState<ExcalidrawElement["id"] | null>(null);
  const [checkedSlideIds, setCheckedSlideIds] = useState<Record<ExcalidrawElement["id"], true>>({});
  const [openSlideMenuId, setOpenSlideMenuId] = useState<ExcalidrawElement["id"] | null>(null);
  const [presentationMenuOpen, setPresentationMenuOpen] = useState(false);
  const [selectedSlidesMenuOpen, setSelectedSlidesMenuOpen] = useState(false);

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

  const setFrameOrders = (
    elements: readonly ExcalidrawElement[],
    orderedFrameIds: readonly ExcalidrawElement["id"][],
  ) => {
    const elementsMap = arrayToMap(elements);

    orderedFrameIds.forEach((id, index) => {
      const frame = elementsMap.get(id);
      if (frame && isFrameElement(frame)) {
        setPresentationOrder(frame, elementsMap, index);
      }
    });

    return elements;
  };

  const checkedFrameIds = useMemo(
    () => frames.filter((frame) => checkedSlideIds[frame.id]).map((frame) => frame.id),
    [checkedSlideIds, frames],
  );

  const getSelectedFrameIds = (frameIds: readonly ExcalidrawElement["id"][]) =>
    frameIds.reduce(
      (acc, frameId) => {
        acc[frameId] = true;
        return acc;
      },
      {} as Record<ExcalidrawElement["id"], true>,
    );

  const getFrameScopedAppState = (frameId: ExcalidrawElement["id"]) => ({
    ...appState,
    selectedElementIds: getSelectedFrameIds([frameId]),
  });

  useEffect(() => {
    const nextFrameIds = new Set(frames.map((frame) => frame.id));

    setCheckedSlideIds((currentCheckedSlideIds) => {
      let changed = false;
      const nextCheckedSlideIds = {} as Record<ExcalidrawElement["id"], true>;

      for (const frameId of Object.keys(currentCheckedSlideIds)) {
        if (nextFrameIds.has(frameId)) {
          nextCheckedSlideIds[frameId] = true;
        } else {
          changed = true;
        }
      }

      return changed ? nextCheckedSlideIds : currentCheckedSlideIds;
    });
  }, [frames]);

  useEffect(() => {
    if (checkedFrameIds.length === 0) {
      setSelectedSlidesMenuOpen(false);
    }
  }, [checkedFrameIds.length]);

  const exportSlide = async (
    frameId: ExcalidrawElement["id"],
    exportType: keyof typeof EXPORT_IMAGE_TYPES,
  ) => {
    const { exportedElements, exportingFrame } = prepareElementsForExport(
      app.scene.getElementsIncludingDeleted(),
      getFrameScopedAppState(frameId),
      true,
    );

    await app.onExportImage(exportType, exportedElements, { exportingFrame });
  };

  const exportSlideAsJSON = async (frameId: ExcalidrawElement["id"], slideIndex: number) => {
    const scopedAppState = getFrameScopedAppState(frameId);
    const exportedElements = getSelectedElements(
      app.scene.getNonDeletedElements(),
      scopedAppState,
      {
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      },
    );

    await saveAsJSON({
      data: {
        elements: exportedElements,
        appState: scopedAppState,
        files: app.files,
      },
      filename: `${app.getName() || "presentation"}-slide-${slideIndex + 1}`,
      fileHandle: null,
    });
  };

  const duplicateSlide = (frameId: ExcalidrawElement["id"]) => {
    const actionResult = actionDuplicateSelection.perform(
      app.scene.getElementsIncludingDeleted(),
      getFrameScopedAppState(frameId),
      null,
      app,
    );

    if (!actionResult) {
      return;
    }

    const nextElements = actionResult.elements || app.scene.getElementsIncludingDeleted();
    const nextSelectedIds = Object.keys(actionResult.appState?.selectedElementIds || {});
    const nextElementsMap = arrayToMap(nextElements);
    const duplicatedFrameId =
      nextSelectedIds.find((id) => {
        const element = nextElementsMap.get(id);
        return !!element && isFrameElement(element);
      }) || null;

    if (duplicatedFrameId) {
      const nextFrameIds = frames.map((frame) => frame.id);
      const insertIndex = nextFrameIds.indexOf(frameId);
      nextFrameIds.splice(insertIndex + 1, 0, duplicatedFrameId);
      setFrameOrders(nextElements, nextFrameIds);
    }

    setOpenSlideMenuId(null);
    app.syncActionResult({
      ...actionResult,
      elements: nextElements,
    });

    if (duplicatedFrameId) {
      app.goToPresentationFrame(duplicatedFrameId);
    }
  };

  const removeSlide = (frameId: ExcalidrawElement["id"]) => {
    const actionResult = actionDeleteSelected.perform(
      app.scene.getElementsIncludingDeleted(),
      getFrameScopedAppState(frameId),
      null,
      app,
    );

    if (!actionResult) {
      return;
    }

    setOpenSlideMenuId(null);
    app.syncActionResult(actionResult);
  };

  const removeSelectedSlides = () => {
    if (checkedFrameIds.length === 0) {
      return;
    }

    const actionResult = actionDeleteSelected.perform(
      app.scene.getElementsIncludingDeleted(),
      {
        ...appState,
        selectedElementIds: getSelectedFrameIds(checkedFrameIds),
      },
      null,
      app,
    );

    if (!actionResult) {
      return;
    }

    setCheckedSlideIds({});
    setSelectedSlidesMenuOpen(false);
    app.syncActionResult(actionResult);
  };

  const renameSlide = (frameId: ExcalidrawElement["id"]) => {
    setOpenSlideMenuId(null);
    app.goToPresentationFrame(frameId);
    setAppState({
      selectedElementIds: getSelectedFrameIds([frameId]),
      editingFrame: frameId,
    });
  };

  const createSlide = (targetFrame: ExcalidrawFrameElement | null) => {
    const nextFrame = newFrameElement({
      x: targetFrame?.x ?? DEFAULT_PRESENTATION_FRAME.x,
      y:
        targetFrame?.y !== undefined
          ? targetFrame.y + targetFrame.height + 64
          : DEFAULT_PRESENTATION_FRAME.y,
      width: targetFrame?.width ?? DEFAULT_PRESENTATION_FRAME.width,
      height: targetFrame?.height ?? DEFAULT_PRESENTATION_FRAME.height,
    });
    const nextElements = [...app.scene.getElementsIncludingDeleted(), nextFrame];
    const nextFrameIds = frames.map((currentFrame) => currentFrame.id);
    const insertIndex = targetFrame ? nextFrameIds.indexOf(targetFrame.id) : -1;

    nextFrameIds.splice(insertIndex + 1, 0, nextFrame.id);
    setFrameOrders(nextElements, nextFrameIds);

    setOpenSlideMenuId(null);
    app.syncActionResult({
      elements: nextElements,
      appState: {
        selectedElementIds: getSelectedFrameIds([nextFrame.id]),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    app.goToPresentationFrame(nextFrame.id);
  };

  const createSlideFromSidebar = () => {
    const targetFrame = frames.find((frame) => frame.id === activeFrameId) || frames.at(-1) || null;

    createSlide(targetFrame);
  };

  const toggleSlideSelection = (frameId: ExcalidrawElement["id"]) => {
    setCheckedSlideIds((currentCheckedSlideIds) => {
      if (currentCheckedSlideIds[frameId]) {
        const nextCheckedSlideIds = { ...currentCheckedSlideIds };
        delete nextCheckedSlideIds[frameId];
        return nextCheckedSlideIds;
      }

      return {
        ...currentCheckedSlideIds,
        [frameId]: true,
      };
    });
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
            aria-label="Create new slide"
            title="Create new slide"
            onClick={createSlideFromSidebar}
          />
          <DropdownMenu open={presentationMenuOpen}>
            <DropdownMenu.Trigger
              className={clsx("PresentationSidebar__headerMenuTrigger", {
                "PresentationSidebar__headerMenuTrigger--open": presentationMenuOpen,
              })}
              onToggle={() => setPresentationMenuOpen((isOpen) => !isOpen)}
              aria-label="Presentation actions"
              title="Presentation actions"
            >
              {DotsIcon}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              className="PresentationSidebar__slideMenu PresentationSidebar__presentationMenu"
              align="end"
              onClickOutside={() => setPresentationMenuOpen(false)}
              onSelect={() => setPresentationMenuOpen(false)}
            >
              <DropdownMenu.Item icon={ExportIcon} onSelect={() => {}}>
                Slides as PDF
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={ExportIcon} onSelect={() => {}}>
                Slides as PPTX
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>

      <ScrollableList className="PresentationSidebar__slides" placeholder="">
        <div className="PresentationSidebar__slidesHeader">
          <div className="PresentationSidebar__slidesTitle">
            {checkedFrameIds.length > 0
              ? `Slides (${checkedFrameIds.length} selected out of ${frames.length})`
              : `Slides (${frames.length})`}
          </div>
          {checkedFrameIds.length > 0 ? (
            <DropdownMenu open={selectedSlidesMenuOpen} dir="rtl">
              <DropdownMenu.Trigger
                className={clsx("PresentationSidebar__slidesMenuTrigger", {
                  "PresentationSidebar__slidesMenuTrigger--open": selectedSlidesMenuOpen,
                })}
                onToggle={() => setSelectedSlidesMenuOpen((isOpen) => !isOpen)}
                aria-label="Selected slides actions"
                title="Selected slides actions"
              >
                {DotsIcon}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                className="PresentationSidebar__slideMenu"
                align="end"
                onClickOutside={() => setSelectedSlidesMenuOpen(false)}
                onSelect={() => setSelectedSlidesMenuOpen(false)}
              >
                <DropdownMenu.Sub>
                  <DropdownMenu.Sub.Trigger icon={ExportIcon}>
                    Export selected as
                  </DropdownMenu.Sub.Trigger>
                  <DropdownMenu.Sub.Content
                    className="PresentationSidebar__slideMenu PresentationSidebar__exportMenu"
                    placement="left"
                    sideOffset={0}
                  >
                    <DropdownMenu.Item icon={ExportIcon} onSelect={() => {}}>
                      PDF
                    </DropdownMenu.Item>
                    <DropdownMenu.Item icon={ExportIcon} onSelect={() => {}}>
                      PPTX
                    </DropdownMenu.Item>
                  </DropdownMenu.Sub.Content>
                </DropdownMenu.Sub>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  icon={TrashIcon}
                  className="PresentationSidebar__slideMenuDanger"
                  onSelect={removeSelectedSlides}
                >
                  Remove selected
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          ) : null}
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
              <button
                type="button"
                role="checkbox"
                aria-checked={!!checkedSlideIds[frame.id]}
                aria-label={`Select slide ${index + 1}`}
                className={clsx("PresentationSidebar__checkbox", {
                  "PresentationSidebar__checkbox--checked": checkedSlideIds[frame.id],
                })}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSlideSelection(frame.id);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <span className="PresentationSidebar__checkboxIcon" aria-hidden>
                  {tablerCheckIcon}
                </span>
              </button>
            </div>
            <div className="PresentationSidebar__slideActionWrapper">
              <DropdownMenu open={openSlideMenuId === frame.id} dir="rtl">
                <DropdownMenu.Trigger
                  className={clsx("PresentationSidebar__slideAction", {
                    "PresentationSidebar__slideAction--open": openSlideMenuId === frame.id,
                  })}
                  onToggle={() =>
                    setOpenSlideMenuId((currentOpenSlideMenuId) =>
                      currentOpenSlideMenuId === frame.id ? null : frame.id,
                    )
                  }
                  aria-label={`Slide ${index + 1} actions`}
                  title="Slide actions"
                  draggable={false}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {DotsHorizontalIcon}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                  className="PresentationSidebar__slideMenu"
                  align="center"
                  onClickOutside={() => setOpenSlideMenuId(null)}
                  onSelect={() => setOpenSlideMenuId(null)}
                >
                  <DropdownMenu.Item
                    icon={playerPlayIcon}
                    onSelect={() => {
                      void app.startPresentation(frame.id);
                    }}
                  >
                    Start presentation
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    icon={shareIcon}
                    onSelect={() => {
                      void exportSlide(frame.id, EXPORT_IMAGE_TYPES.clipboard);
                    }}
                  >
                    Share presentation
                  </DropdownMenu.Item>
                  <DropdownMenu.Sub>
                    <DropdownMenu.Sub.Trigger icon={ExportIcon}>
                      Export slide as
                    </DropdownMenu.Sub.Trigger>
                    <DropdownMenu.Sub.Content
                      className="PresentationSidebar__slideMenu PresentationSidebar__exportMenu"
                      placement="left"
                      sideOffset={0}
                    >
                      <DropdownMenu.Item icon={ExportIcon} onSelect={() => {}}>
                        PDF
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        icon={pngIcon}
                        onSelect={() => {
                          void exportSlide(frame.id, EXPORT_IMAGE_TYPES.png);
                        }}
                      >
                        PNG
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        icon={svgIcon}
                        onSelect={() => {
                          void exportSlide(frame.id, EXPORT_IMAGE_TYPES.svg);
                        }}
                      >
                        SVG
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        icon={saveAs}
                        onSelect={() => {
                          void exportSlideAsJSON(frame.id, index);
                        }}
                      >
                        JSON
                      </DropdownMenu.Item>
                    </DropdownMenu.Sub.Content>
                  </DropdownMenu.Sub>
                  <DropdownMenu.Item icon={copyIcon} onSelect={() => duplicateSlide(frame.id)}>
                    Duplicate slide
                  </DropdownMenu.Item>
                  <DropdownMenu.Item icon={pencilIcon} onSelect={() => renameSlide(frame.id)}>
                    Rename slide
                  </DropdownMenu.Item>
                  <DropdownMenu.Item icon={PlusIcon} onSelect={() => createSlide(frame)}>
                    Create new slide
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    icon={TrashIcon}
                    className="PresentationSidebar__slideMenuDanger"
                    onSelect={() => removeSlide(frame.id)}
                  >
                    Remove slide
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
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
