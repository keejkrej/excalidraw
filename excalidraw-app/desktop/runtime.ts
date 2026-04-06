import type {
  ExcalidrawFileHandle,
  ExcalidrawNativeFileHandle,
} from "@excalidraw/excalidraw/types";

type ReadFileResponse = {
  bytesBase64: string;
  name: string;
};

type DesktopOpenFilesPayload = {
  paths: string[];
};

type DesktopOpenListener = (paths: string[]) => void | Promise<void>;

const pendingOpenPaths: string[] = [];
const openListeners = new Set<DesktopOpenListener>();

let desktopRuntimePromise: Promise<void> | null = null;

export const isDesktopApp = import.meta.env.VITE_DESKTOP_APP === "true";

export const isNativeFileHandle = (
  handle: ExcalidrawFileHandle | null | undefined,
): handle is ExcalidrawNativeFileHandle => {
  return !!handle && "kind" in handle && handle.kind === "native";
};

const getAbortError = () => {
  try {
    return new DOMException("The operation was aborted.", "AbortError");
  } catch {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    return error;
  }
};

const dedupePaths = (paths: string[]) => {
  return [...new Set(paths.filter(Boolean))];
};

const queueOpenPaths = (paths: string[]) => {
  const nextPaths = dedupePaths(paths);
  if (!nextPaths.length) {
    return;
  }

  if (openListeners.size) {
    for (const listener of openListeners) {
      void listener(nextPaths);
    }
    return;
  }

  pendingOpenPaths.push(...nextPaths);
};

const getFileNameFromPath = (path: string) => {
  const parts = path.split(/[/\\]/);
  return parts.at(-1) || path;
};

const getMimeTypeFromName = (name: string): string => {
  if (/\.(excalidraw|json)$/i.test(name)) {
    return "application/json";
  }
  if (/\.excalidrawlib$/i.test(name)) {
    return "application/vnd.excalidrawlib+json";
  }
  if (/\.png$/i.test(name)) {
    return "image/png";
  }
  if (/\.svg$/i.test(name)) {
    return "image/svg+xml";
  }
  if (/\.jpe?g$/i.test(name)) {
    return "image/jpeg";
  }
  return "";
};

const uint8ArrayToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToUint8Array = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toNativeFileHandle = (path: string): ExcalidrawNativeFileHandle => ({
  kind: "native",
  path,
  name: getFileNameFromPath(path),
});

const addNativeHandleToFile = (
  file: File,
  fileHandle: ExcalidrawNativeFileHandle,
) => {
  Object.defineProperty(file, "handle", {
    value: fileHandle,
    configurable: true,
  });
  return file;
};

export const readDesktopFile = async (path: string) => {
  const [{ invoke }] = await Promise.all([import("@tauri-apps/api/core")]);
  const { bytesBase64, name } = await invoke<ReadFileResponse>("read_file", {
    path,
  });

  const fileHandle = toNativeFileHandle(path);
  const bytes = base64ToUint8Array(bytesBase64);
  const file = addNativeHandleToFile(
    new File([bytes], name, {
      type: getMimeTypeFromName(name),
    }),
    fileHandle,
  );

  return { file, fileHandle };
};

const toDialogFilters = (extensions?: string[]) => {
  if (!extensions?.length) {
    return undefined;
  }

  const normalizedExtensions = extensions.map((extension) =>
    extension.replace(/^\./, ""),
  );

  return [
    {
      name: "Excalidraw files",
      extensions: normalizedExtensions,
    },
  ];
};

const shouldUseNativeOpen = (url?: string | URL) => {
  if (!url) {
    return false;
  }

  const href = String(url);
  return /^(https?:|mailto:|tel:)/i.test(href);
};

export const installDesktopRuntime = async () => {
  if (!isDesktopApp) {
    return;
  }

  if (desktopRuntimePromise) {
    return desktopRuntimePromise;
  }

  desktopRuntimePromise = (async () => {
    const [
      { invoke },
      { listen },
      dialog,
      opener,
    ] = await Promise.all([
      import("@tauri-apps/api/core"),
      import("@tauri-apps/api/event"),
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-opener"),
      import("@tauri-apps/plugin-opener/init"),
    ]);

    const originalOpen = window.open.bind(window);

    window.open = ((url, target, features) => {
      if (shouldUseNativeOpen(url)) {
        void opener.openUrl(String(url));
        return null;
      }
      return originalOpen(url, target, features);
    }) as typeof window.open;

    window.EXCALIDRAW_FS_ADAPTER = {
      supported: true,
      open: async (opts) => {
        const selection = await dialog.open({
          title: opts.description,
          multiple: opts.multiple ?? false,
          filters: toDialogFilters(opts.extensions),
        });

        if (!selection) {
          throw getAbortError();
        }

        if (Array.isArray(selection)) {
          return Promise.all(
            selection.map((path) => readDesktopFile(path).then(({ file }) => file)),
          );
        }

        const { file } = await readDesktopFile(selection);
        return file;
      },
      save: async (blob, opts) => {
        const resolvedBlob = await blob;

        let path = isNativeFileHandle(opts.fileHandle)
          ? opts.fileHandle.path
          : null;

        if (!path) {
          path = await dialog.save({
            title: opts.description,
            defaultPath: `${opts.name}.${opts.extension}`,
            filters: toDialogFilters([opts.extension]),
          });
        }

        if (!path) {
          throw getAbortError();
        }

        const bytes = new Uint8Array(await resolvedBlob.arrayBuffer());
        await invoke("write_file", {
          path,
          bytesBase64: uint8ArrayToBase64(bytes),
        });

        return toNativeFileHandle(path);
      },
    };

    const initialPaths = await invoke<string[]>("get_launch_paths");
    queueOpenPaths(initialPaths);

    await listen<DesktopOpenFilesPayload>("desktop-open-files", (event) => {
      queueOpenPaths(event.payload.paths);
    });
  })();

  return desktopRuntimePromise;
};

export const onDesktopOpenFiles = (listener: DesktopOpenListener) => {
  openListeners.add(listener);

  if (pendingOpenPaths.length) {
    const queuedPaths = dedupePaths([...pendingOpenPaths]);
    pendingOpenPaths.length = 0;
    void listener(queuedPaths);
  }

  return () => {
    openListeners.delete(listener);
  };
};
