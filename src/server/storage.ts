import { mkdir, open, readdir, realpath, stat, unlink, FileHandle } from 'fs/promises';
import { flock } from 'fs-ext';
import { dirname, join } from 'path';
import { Maybe } from 'seidr';

export interface Storage {
  scan<T>(filter: (path: string) => Maybe<T>): Promise<Map<string, T>>;
  exists(path: string): Promise<boolean>;
  readPath(path: string): Promise<string>;
  writePath(path: string, data: string): Promise<void>;
  writePathIfNonExistent(path: string, data: string): Promise<boolean>;
  deletePath(path: string): Promise<boolean>;
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
    const scanDir = async (path: string) => {
      console.log(`SCANNING PATH: ${path}`);
      const matches = new Map<string, T>();
      const promises = new Array<Promise<Map<string, T>>>();

      return readdir(path, { withFileTypes: true })
        .then(async (results) => {
          for (const p of results) {
            const fullPath = join(path, p.name);
            const subPath = fullPath.substring(this._canonicalRootPath.length + 1);

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
            if (values.length === 0) {
              return matches;
            } else {
              // console.log(`VALUES.SIZE = ${[...values.keys()].length}, MATCHES.SIZE = ${[...matches.keys()].length}`);
              const reducer = (val: Map<string, T>, memo: Map<string, T>): Map<string, T> => {
                // TODO: is there a better/immutable way to merge Maps
                // console.log(`MEMO.SIZE = ${[...memo.keys()].length}`);
                val.forEach((val, key) => memo.set(key, val));
                return memo
              }

              return values.reduce(reducer, matches);
            }
          });
        });
    }

    // TODO: why is this returning an empty Map?
    // Note: you can call async functions from non-async functions, you just can't use the await keyword, you need to work with the returned Promise directly (https://javascript.info/task/async-from-regular)
    return scanDir(await this.canonicalRootPath());
  }

  async foo(): Promise<string> {
    return Promise.resolve("foo");
  }

  bar(): void {
    const r = Promise.resolve(this.foo()).then(x => { return x });
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
      const buffer = await this.lockFile(openHandle, "ex", () => openHandle.readFile());
      return buffer.toString();
    } finally {
      handle?.close();
    }
  }

  async writePath(path: string, data: string): Promise<void> {
    let handle: FileHandle | undefined;

    try {
      const fullPath = await this.toFullPath(path);
      await mkdir(dirname(fullPath), { recursive: true });
      const openHandle = await open(fullPath, "w");
      handle = openHandle;
      await this.lockFile(openHandle, "ex", () => openHandle.write(data));
    } finally {
      await handle?.close();
    }
  }

  async writePathIfNonExistent(path: string, data: string): Promise<boolean> {
    if (await this.exists(path)) {
      return Promise.resolve(false);
    } else {
      return this.writePath(path, data)
        .then(() => true)
        .catch(() => false);  // TODO: misleading, since a failed write looks the same as path already exists
    }
  }

  async deletePath(path: string): Promise<boolean> {
    let handle: FileHandle | undefined;

    try {
      const fullPath = await this.toFullPath(path);
      const openHandle = await open(fullPath, "w");
      handle = openHandle;

      return this.lockFile(openHandle, "ex", () => unlink(path))
        .then(() => true)
        .catch(() => false);
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

export class InMemoryStorage implements Storage {
  files: Map<string, string>;

  constructor() {
    this.files = new Map<string, string>();
  }

  async scan<T>(filter: (path: string) => Maybe<T>): Promise<Map<string, T>> {
    const matches = new Map<string, T>();
    this.files.forEach((_value: string, path: string) => {
      filter(path).caseOf({
        Just: val => matches.set(path, val),
        Nothing: () => matches
      });
    });

    return Promise.resolve(matches);
  }

  async exists(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  async readPath(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      return Promise.reject();
    } else {
      return Promise.resolve(value);
    }
  }

  async writePath(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }

  async deletePath(path: string): Promise<boolean> {
    if (this.files.has(path)) {
      this.files.delete(path);
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  }

  async writePathIfNonExistent(path: string, data: string): Promise<boolean> {
    if (this.files.has(path)) {
      return Promise.resolve(false);
    } else {
      this.files.set(path, data);
      return Promise.resolve(true);
    }
  }
}
