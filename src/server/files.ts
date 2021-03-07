import { open, fstat, read, close } from 'fs';
import { flock } from 'fs-ext';

export function openFile(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    open(path, 'r', (err, id) => {
      if (err) {
        console.log(`GOT ERR: ${err}`);
        reject(err);
      } else {
        resolve(id);
      }
    });
  });
}

export type LockMode = "ex" | "sh" | "shnb" | "exnb" | "un";

export function lockFile<T>(fd: number, mode: LockMode, handler: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    flock(fd, mode, (err: Error) => {
      if (err) {
        reject(err);
      }
      resolve(handler());
    });
  });
}

export function fileSize(fd: number): Promise<number> {
  return new Promise((resolve, reject) => {
    fstat(fd, (err, stats) => {
      if (err) {
        reject(err);
      } else {
        resolve(stats.size);
      }
    });
  });
}

// Notes:
// http://thecodebarbarian.com/async-await-error-handling-in-javascript.html

export function readFile(fd: number): Promise<string> {
  return new Promise((resolve, reject) => {
    fileSize(fd)
      .then(size => {
        let buffer = Buffer.alloc(size);
        let bytesRead = 0
        let chunkSize = 1024
        let totalBytesRead = 0

        while (bytesRead < size) {
          if ((bytesRead + chunkSize) > size) {
            chunkSize = (size - bytesRead);
          }

          read(fd, buffer, bytesRead, chunkSize, bytesRead, (err: Error, bytesRead: number, buffer: Buffer) => {
            if (err) {
              reject(err);
            } else {
              totalBytesRead += bytesRead;
              if (totalBytesRead == size) {
                resolve(buffer.toString());
              }
            }
          });

          bytesRead += chunkSize;
        }
      })
      .catch(err => {
        reject(err);
      })
  });
}

export function closeFile(fd: number): Promise<void> {
  return new Promise((resolve, reject) => {
    close(fd, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function readPath(path: string): Promise<string> {
  let fd = await openFile(path);
  let data = await lockFile(fd, "ex", () => readFile(fd));
  // TODO: how does this make sure the file is always closed?
  await closeFile(fd);

  return data;
}

export function readPath2(path: string, fn: (v: string) => void): void {
  readPath(path)
    .then(v => fn(v))
    .catch(err => fn("ERROR"));
}
