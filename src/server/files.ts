import { open, FileHandle } from 'fs/promises';
import { flock } from 'fs-ext';

export type LockMode = "ex" | "sh" | "shnb" | "exnb" | "un";

export function lockFile<T>(handle: FileHandle, mode: LockMode, handler: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    flock(handle.fd, mode, (err: Error) => {
      if (err) {
        reject(err);
      }
      resolve(handler());
    });
  });
}

export async function readPath(path: string): Promise<string> {
  let handle: FileHandle;

  try {
    handle = await open(path, "r");
    let buffer = await lockFile(handle, "ex", () => handle.readFile());
    return buffer.toString();
  } finally {
    handle?.close();
  }
}

export async function writePath(path: string, data: string): Promise<void> {
  let handle: FileHandle;

  try {
    handle = await open(path, "w");
    await lockFile(handle, "ex", () => handle.write(data));
  } finally {
    await handle?.close();
  }
}

export function readPath2(path: string, fn: (v: string) => void): void {
  readPath(path)
    .then(v => fn(v))
    .catch(err => fn("ERROR"));
}
