import { open, stat, FileHandle } from 'fs/promises';
import { flock } from 'fs-ext';

export interface Storage {
  exists(path: string): Promise<boolean>;
  readPath(path: string): Promise<string>;
  writePath(path: string, data: string): Promise<void>;
}

type LockMode = "ex" | "sh" | "shnb" | "exnb" | "un";

export class FileStorage implements Storage {
  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async readPath(path: string): Promise<string> {
    let handle: FileHandle;

    try {
      handle = await open(path, "r");
      let buffer = await this.lockFile(handle, "ex", () => handle.readFile());
      return buffer.toString();
    } finally {
      handle?.close();
    }
  }

  async writePath(path: string, data: string): Promise<void> {
    let handle: FileHandle;

    try {
      handle = await open(path, "w");
      await this.lockFile(handle, "ex", () => handle.write(data));
    } finally {
      await handle?.close();
    }
  }

  async lockFile<T>(handle: FileHandle, mode: LockMode, handler: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      flock(handle.fd, mode, (err: Error) => {
        if (err) {
          reject(err);
        }
        resolve(handler());
      });
    });
  }
}
