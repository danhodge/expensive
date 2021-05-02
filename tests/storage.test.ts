import { FileStorage } from '../src/server/storage';

test("scan dir", async () => {
  let storage = new FileStorage("/Users/dan/development/projects/gh_expensive/src");
  let paths = await storage.scan((p: string) => true);

  expect(paths).toEqual(["a"]);
});
