import { Just, Nothing } from 'seidr';
import { basename, dirname, extname, resolve } from 'path';
import { FileStorage } from '../src/server/storage';

test("scan dir", async () => {
  const storage = new FileStorage(resolve("./src"));
  const scanner = (path: string) => {
    if (basename(dirname(path)) === "client" && extname(path) === ".js") {
      return Just(path);
    } else {
      return Nothing();
    }
  };
  const paths = await storage.scan(scanner);

  expect(paths.size).toEqual(1);
  expect([...paths.values()].map((p) => basename(p))).toEqual(["index.js"]);
});

test("delete path", async () => {
  const storage = new FileStorage(resolve("."));
  const path = "dummy.txt";

  await storage.writePath(path, "Dummy Data");
  expect(await storage.exists(path)).toEqual(true);

  expect(await storage.deletePath(path)).toEqual(true);
  expect(await storage.exists(path)).toEqual(false);
});
