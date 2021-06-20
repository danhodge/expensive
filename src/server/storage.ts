import { Dirent } from 'fs';
import { open, readdir, realpath, stat, FileHandle } from 'fs/promises';
import { flock } from 'fs-ext';
import { join } from 'path';
import { Maybe, Just, Nothing } from 'seidr';

export interface Storage {
  scan<T>(filter: (path: string) => Maybe<T>): Promise<Map<string, T>>;
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
  _canonicalRootPath!: string;

  constructor(readonly rootPath: string) { }

  // recursion + promises based on: https://medium.com/@wrj111/recursive-promises-in-nodejs-769d0e4c0cf9
  async scan<T>(filter: (path: string) => Maybe<T>): Promise<Map<string, T>> {
    let scanDir = async (path: string) => {
      let matches = new Map<string, T>();
      let promises = new Array<Promise<Map<string, T>>>();

      return readdir(path, { withFileTypes: true })
        .then(async (results) => {
          for (const p of results) {
            let fullPath = join(path, p.name);
            let subPath = fullPath.substring(this._canonicalRootPath.length + 1);

            if (p.isDirectory()) {
              promises.push(scanDir(fullPath));
            } else {
              filter(subPath).caseOf({
                Just: val => matches.set(subPath, val),
                Nothing: () => matches
              });
            }
          }

          return Promise.all(promises).then((values) => {
            const reducer = (val: Map<string, T>, memo: Map<string, T>): Map<string, T> => {
              // TODO: is there a better/immutable way to merge Maps
              val.forEach((val, key) => memo.set(key, val));
              return memo
            }

            return values.reduce(reducer, matches);
          });
        });
    }

    return scanDir(await this.canonicalRootPath());
  }

  // TODO: is there an established pattern for this?
  async canonicalRootPath(): Promise<string> {
    if (this._canonicalRootPath) {
      return Promise.resolve(this._canonicalRootPath);
    } else {
      return realpath(this.rootPath).then(path => {
        this._canonicalRootPath = path;
        return path;
      });
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = await this.toFullPath(path);
      await stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async readPath(path: string): Promise<string> {
    let handle: FileHandle | undefined;

    try {
      const fullPath = await this.toFullPath(path);
      // see: https://stackoverflow.com/questions/57385552/object-is-possibly-undefined-in-typescript
      const openHandle = await open(fullPath, "r");
      handle = openHandle;
      let buffer = await this.lockFile(openHandle, "ex", () => openHandle.readFile());
      return buffer.toString();
    } finally {
      handle?.close();
    }
  }

  async writePath(path: string, data: string): Promise<void> {
    let handle: FileHandle | undefined;

    try {
      const fullPath = await this.toFullPath(path);
      const openHandle = await open(fullPath, "w");
      handle = openHandle;
      await this.lockFile(openHandle, "ex", () => openHandle.write(data));
    } finally {
      await handle?.close();
    }
  }

  async toFullPath(path: string): Promise<string> {
    return join(await this.canonicalRootPath(), path);
  }

  async lockFile<T>(handle: FileHandle, mode: LockMode, handler: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      flock(handle.fd, mode, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          reject(err);
        }
        resolve(handler());
      });
    });
  }
}
