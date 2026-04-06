import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as browserNativeFileSystemSupported,
} from "browser-fs-access";

import { MIME_TYPES } from "@excalidraw/common";

import { normalizeFile } from "./blob";

import type { ExcalidrawFileHandle } from "../types";

type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, "binary">;

type HostFilesystemAdapter = NonNullable<typeof window.EXCALIDRAW_FS_ADAPTER>;

const getHostFilesystemAdapter = (): HostFilesystemAdapter | undefined =>
  window.EXCALIDRAW_FS_ADAPTER;

export const fileOpen = async <M extends boolean | undefined = false>(opts: {
  extensions?: FILE_EXTENSION[];
  description: string;
  multiple?: M;
}): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

  const hostAdapter = getHostFilesystemAdapter();
  if (hostAdapter?.supported) {
    return hostAdapter.open(opts) as unknown as RetType;
  }

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(MIME_TYPES[type]);

    return mimeTypes;
  }, [] as string[]);

  const extensions = opts.extensions?.reduce((acc, ext) => {
    if (ext === "jpg") {
      return acc.concat(".jpg", ".jpeg");
    }
    return acc.concat(`.${ext}`);
  }, [] as string[]);

  const files = await _fileOpen({
    description: opts.description,
    extensions,
    mimeTypes,
    multiple: opts.multiple ?? false,
  });

  if (Array.isArray(files)) {
    return (await Promise.all(files.map((file) => normalizeFile(file)))) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
};

export const fileSave = (
  blob: Blob | Promise<Blob>,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    extension: FILE_EXTENSION;
    mimeTypes?: string[];
    description: string;
    /** existing file handle */
    fileHandle?: ExcalidrawFileHandle | null;
  },
) => {
  const hostAdapter = getHostFilesystemAdapter();
  if (hostAdapter?.supported) {
    return hostAdapter.save(blob, opts);
  }

  return _fileSave(
    blob,
    {
      fileName: `${opts.name}.${opts.extension}`,
      description: opts.description,
      extensions: [`.${opts.extension}`],
      mimeTypes: opts.mimeTypes,
    },
    opts.fileHandle as FileSystemFileHandle | null | undefined,
    false,
  );
};

export const nativeFileSystemSupported =
  !!getHostFilesystemAdapter()?.supported || browserNativeFileSystemSupported;
