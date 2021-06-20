import { basename, dirname, extname, resolve } from 'path';
import { FileStorage } from '../src/server/storage';

test("scan dir", async () => {
  const storage = new FileStorage(resolve("./src"));
  const scanner = (path: string) => {
    return basename(dirname(path)) === "client" && extname(path) === ".js";
  };
  const paths = await storage.scan(scanner);

  expect(paths.length).toEqual(1);
  expect(paths.map((p) => basename(p))).toEqual(["index.js"]);
});
