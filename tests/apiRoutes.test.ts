import request from 'supertest';
import { mock, instance, when, anyFunction } from 'ts-mockito';
import { createApp } from '../src/server/server';
import { createRoutes } from '../src/server/routes';
import { InMemoryStorage, Storage } from '../src/server/storage';
import { DatabaseManager } from '../src/server/databaseManager';
import { DatabaseConfig } from '../src/server/database';

test("returns OK", async () => {
  const dbId = "123";
  const accountId = "456";
  const storage: Storage = new InMemoryStorage();
  const dbMgr: DatabaseManager = new DatabaseManager(storage);

  storage.writePath("testdb.journal", "; Empty Journal\n");
  const _db = await dbMgr.createDatabase(new DatabaseConfig(dbId, "testdb", "testdb.journal", `data/${dbId}`));

  const app = createApp(createRoutes(dbMgr));

  const res = await request(app)
    .post(`/api/${dbId}/upload/${accountId}`)
    .send("col1,col2\nval1,val2\n")
    .set('Content-Type', 'text/csv');

  expect(res.status).toEqual(200);
  expect(res.text).toContain("Hello");
});
