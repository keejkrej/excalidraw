import {
  Excalidraw,
  CaptureUpdateAction,
  ExcalidrawAPIProvider,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { CommandPalette } from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  debounce,
  isDevEnv,
  isTestEnv,
  preventUnload,
  resolvablePromise,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useHandleLibrary } from "@excalidraw/excalidraw/data/library";
import { t } from "@excalidraw/excalidraw/i18n";
import { isElementLink, isInitializedImageElement } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { restoreAppState, restoreElements } from "@excalidraw/excalidraw/data/restore";
import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import { Provider, appJotaiStore, useAtomValue } from "./app-jotai";
import { STORAGE_KEYS, SYNC_BROWSER_TABS_TIMEOUT } from "./app_constants";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import { AppFooter } from "./components/AppFooter";
import { DesktopErrorBoundary } from "./components/DesktopErrorBoundary";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import { importFromLocalStorage } from "./data/localStorage";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { onDesktopOpenFiles, readDesktopFile } from "./desktop/runtime";
import { useHandleAppTheme } from "./useHandleAppTheme";

import "./index.scss";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

const stripUnsupportedDesktopUrlState = () => {
  const hasUnsupportedSearch = new URLSearchParams(window.location.search).has("id");
  const hasUnsupportedHash =
    /^#(json=|room=|url=)/.test(window.location.hash) ||
    window.location.hash.includes("addLibrary=");
  const hasUnsupportedQuery = window.location.search.includes("addLibrary=");
  const hasUnsupportedPath = window.location.pathname === "/excalidraw-plus-export";

  if (hasUnsupportedSearch || hasUnsupportedHash || hasUnsupportedQuery || hasUnsupportedPath) {
    window.history.replaceState({}, APP_NAME, window.location.origin);
  }
};

stripUnsupportedDesktopUrlState();

const initializeScene = async (): Promise<{
  scene: ExcalidrawInitialDataState | null;
  isExternalScene: false;
}> => {
  stripUnsupportedDesktopUrlState();

  const localDataState = importFromLocalStorage();

  return {
    scene: {
      elements: restoreElements(localDataState?.elements, null, {
        repairBindings: true,
        deleteInvisibleElements: true,
      }),
      appState: restoreAppState(localDataState?.appState, null),
    } as Omit<RestoredDataState, "files">,
    isExternalScene: false,
  };
};

const ExcalidrawDesktopWrapper = () => {
  const excalidrawAPI = useExcalidrawAPI();

  const [errorMessage, setErrorMessage] = useState("");
  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();
  const [langCode, setLangCode] = useAppLangCode();

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });

  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise = resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const [, forceRefresh] = useState(false);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
    validateLibraryUrl: () => false,
  });

  useEffect(() => {
    if (!isDevEnv()) {
      return;
    }

    const debugState = loadSavedDebugState();

    if (debugState.enabled && !window.visualDebug) {
      window.visualDebug = { data: [] };
    } else {
      delete window.visualDebug;
    }
    forceRefresh((prev) => !prev);
  }, [excalidrawAPI]);

  const loadImages = useCallback(
    (data: ResolutionType<typeof initializeScene>, isInitialLoad = false) => {
      if (!data.scene || !excalidrawAPI) {
        return;
      }

      const fileIds =
        data.scene.elements?.reduce((acc, element) => {
          if (isInitializedImageElement(element)) {
            return acc.concat(element.fileId);
          }
          return acc;
        }, [] as FileId[]) || [];

      if (fileIds.length) {
        LocalData.fileStorage.getFiles(fileIds).then(({ loadedFiles, erroredFiles }) => {
          if (loadedFiles.length) {
            excalidrawAPI.addFiles(loadedFiles);
          }
          updateStaleImageStatuses({
            excalidrawAPI,
            erroredFiles,
            elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
          });
        });
      }

      if (isInitialLoad) {
        LocalData.fileStorage.clearObsoleteFiles({
          currentFileIds: fileIds,
        });
      }
    },
    [excalidrawAPI],
  );

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    initializeScene().then((data) => {
      loadImages(data, true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const syncData = debounce(() => {
      if (isTestEnv() || document.hidden) {
        return;
      }

      if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
        const localDataState = importFromLocalStorage();
        setLangCode(getPreferredLanguage());
        excalidrawAPI.updateScene({
          ...localDataState,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        LibraryIndexedDBAdapter.load().then((data) => {
          if (data) {
            excalidrawAPI.updateLibrary({
              libraryItems: data.libraryItems,
            });
          }
        });
      }

      if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
        const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
        const currFiles = excalidrawAPI.getFiles();
        const fileIds =
          elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element) && !currFiles[element.fileId]) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (fileIds.length) {
          LocalData.fileStorage.getFiles(fileIds).then(({ loadedFiles, erroredFiles }) => {
            if (loadedFiles.length) {
              excalidrawAPI.addFiles(loadedFiles);
            }
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (event.type === EVENT.VISIBILITY_CHANGE || event.type === EVENT.FOCUS) {
        syncData();
      }
    };

    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);

    return () => {
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    };
  }, [excalidrawAPI, loadImages, setLangCode]);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (LocalData.fileStorage.shouldPreventUnload(excalidrawAPI.getSceneElements())) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn("preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)");
        }
      }
    };

    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (!excalidrawAPI) {
          return;
        }

        let didChange = false;
        const nextElements = excalidrawAPI.getSceneElementsIncludingDeleted().map((element) => {
          if (LocalData.fileStorage.shouldUpdateImageElementStatus(element)) {
            const nextElement = newElementWith(element, { status: "saved" });
            if (nextElement !== element) {
              didChange = true;
            }
            return nextElement;
          }
          return element;
        });

        if (didChange) {
          excalidrawAPI.updateScene({
            elements: nextElements,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
      });
    }

    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(debugCanvasRef.current, appState, elements, window.devicePixelRatio);
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const loadDesktopSceneFromPath = useCallback(
    async (path: string) => {
      if (!excalidrawAPI) {
        return;
      }

      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const { file, fileHandle } = await readDesktopFile(path);
      const loadedScene = await loadFromBlob(file, appState, elements, fileHandle);

      excalidrawAPI.updateScene({
        elements: loadedScene.elements,
        appState: {
          ...loadedScene.appState,
          errorMessage: null,
          isLoading: false,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      excalidrawAPI.addFiles(Object.values(loadedScene.files));
    },
    [excalidrawAPI],
  );

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    return onDesktopOpenFiles(async (paths) => {
      const [path] = paths;
      if (!path) {
        return;
      }

      const sceneHasContent = excalidrawAPI.getSceneElements().length > 0;
      if (
        sceneHasContent &&
        !(await openConfirmModal({
          title: t("overwriteConfirm.modal.loadFromFile.title"),
          actionLabel: t("overwriteConfirm.modal.loadFromFile.button"),
          color: "warning",
          description: (
            <Trans
              i18nKey="overwriteConfirm.modal.loadFromFile.description"
              bold={(text) => <strong>{text}</strong>}
              br={() => <br />}
            />
          ),
        }))
      ) {
        return;
      }

      try {
        await loadDesktopSceneFromPath(path);
      } catch (error: any) {
        console.error(error);
        setErrorMessage(error.message || t("alerts.couldNotLoadInvalidFile"));
      }
    });
  }, [excalidrawAPI, loadDesktopSceneFromPath]);

  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(async function* () {
    let snapshot = FileStatusStore.getSnapshot();
    const { pending, total } = FileStatusStore.getPendingCount(snapshot.value);

    if (pending === 0) {
      return;
    }

    yield {
      type: "progress",
      progress: (total - pending) / total,
      message: `Loading images (${total - pending}/${total})...`,
    };

    while (true) {
      snapshot = await FileStatusStore.pull(snapshot.version);
      const { pending: nowPending, total: nowTotal } = FileStatusStore.getPendingCount(
        snapshot.value,
      );

      yield {
        type: "progress",
        progress: (nowTotal - nowPending) / nowTotal,
        message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
      };

      if (nowPending === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        yield {
          type: "progress",
          message: "Preparing export...",
        };
        return;
      }
    }
  }, []);
  return (
    <div style={{ height: "100%" }} className={clsx("excalidraw-app")}>
      <Excalidraw
        onChange={onChange}
        onExport={onExport}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={false}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
            return;
          }

          event.preventDefault();
        }}
      >
        <AppMainMenu
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          refresh={() => forceRefresh((prev) => !prev)}
        />
        <AppWelcomeScreen />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
        </OverwriteConfirmDialog>
        <AppFooter onChange={() => excalidrawAPI?.refresh()} />

        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">{t("alerts.localStorageQuotaExceeded")}</div>
        )}

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>{errorMessage}</ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK);
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
    <DesktopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawAPIProvider>
          <ExcalidrawDesktopWrapper />
        </ExcalidrawAPIProvider>
      </Provider>
    </DesktopErrorBoundary>
  );
};

export default ExcalidrawApp;
