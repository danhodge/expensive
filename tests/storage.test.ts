import { basename, dirname, extname, resolve } from 'path';
import { FileStorage } from '../src/server/storage';

test("scan dir", async () => {
  let storage = new FileStorage(resolve("./src"));
  let scanner = (path: string) => {
    return basename(dirname(path)) === "client" && extname(path) === ".js";
  };
  let paths = await storage.scan(scanner);

  expect(paths.length).toEqual(1);
  expect(paths.map((p) => basename(p))).toEqual(["index.js"]);
});
