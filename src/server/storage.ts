import { Dirent } from 'fs';
import { open, readdir, stat, FileHandle } from 'fs/promises';
import { flock } from 'fs-ext';
import { join } from 'path';

export interface Storage {
  scan(filter: (path: string) => boolean): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  readPath(path: string): Promise<string>;
  writePath(path: string, data: string): Promise<void>;
}

type LockMode = "ex" | "sh" | "shnb" | "exnb" | "un";

/*
 * Directory Structure
 * root/
 *     /dbId1/
 *           /db.journal
 *           /meta.json
 *           /data/
 *                /timestamp1.csv
 *                /timestamp2.csv
 *     /dbId2/
 *           /db.journal
 *
 * root/
 *     /id1.expensive.json
 *     /id2.expensive.json
 *
 * {
 *   name: "",
 *   journal: "/id.journal",
 *   dataDir: "/data/id/"
 * }
 */
export class FileStorage implements Storage {
  constructor(readonly rootPath: string) {
  }

  async *scanz() {
    let scanDir = async (path: string) => {
    };

    // yield new

    // scanDir(this.rootPath, (path) => { yield path });
  }

  // recursion + promises based on: https://medium.com/@wrj111/recursive-promises-in-nodejs-769d0e4c0cf9
  async scan(filter: (path: string) => boolean): Promise<string[]> {
    let scanDir = async (path: string) => {
      let matches = new Array<string>();
      let promises = new Array<Promise<string[]>>();

      return readdir(path, { withFileTypes: true })
        .then(async (results) => {
          for (const p of results) {
            let fullPath = join(path, p.name);
            let subPath = fullPath.substring(this.rootPath.length);

            if (p.isDirectory()) {
              promises.push(scanDir(fullPath));
            } else if (filter(subPath)) {
              matches.push(subPath);
            }
          }

          return Promise.all(promises).then((values) => {
            return ([] as string[]).concat(...values).concat(matches)
          });
        });
    }

    return scanDir(this.rootPath);
  }

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
