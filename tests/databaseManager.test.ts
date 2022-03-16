import { mock, instance, when, anyFunction } from 'ts-mockito';
import { Storage, InMemoryStorage } from '../src/server/storage';
import { DatabaseManager } from '../src/server/databaseManager';

test("loads the databases on demand", async () => {
  const storage: Storage = new InMemoryStorage();
  storage.writePath("1234.expensive.json", JSON.stringify({ "id": "1234", "name": "test123", "journal": "1234.journal", "dataDir": "data/1234", "accounts": [] }));
  storage.writePath("1234.journal", "");

  const dbs = await new DatabaseManager(storage).databases();

  expect(dbs.length).toEqual(1);
  expect(dbs[0].id()).toEqual("1234");
  expect(dbs[0].name()).toEqual("test123");
});

test("it omits missing databases", async () => {
  const mockStorage: Storage = mock();
  const storage: Storage = instance(mockStorage);
  const results = new Map<string, string>([["1234.expensive.json", "1234"], ["5678.expensive.json", "5678"]]);
  when(mockStorage.scan(anyFunction())).thenResolve(results);
  when(mockStorage.readPath('1234.expensive.json')).thenResolve(JSON.stringify({ "id": "1234", "name": "test123", "journal": "1234.journal", "dataDir": "data/1234", "accounts": [] }));
  when(mockStorage.readPath('5678.expensive.json')).thenResolve(JSON.stringify({ "id": "5678", "name": "test456", "journal": "5678.journal", "dataDir": "data/5678", "accounts": [] }));
  when(mockStorage.readPath('1234.journal')).thenReject();
  when(mockStorage.readPath('5678.journal')).thenResolve("");

  const dbs = await new DatabaseManager(storage).databases();

  expect(dbs.map(db => db.name())).toEqual(['test456']);
});

test("it omits database with bad config", async () => {
  const storage: Storage = new InMemoryStorage();
  storage.writePath("1234.expensive.json", JSON.stringify({ "name": "test123", "journal": "1234.journal", "data": 123 }));

  const dbs = await new DatabaseManager(storage).databases();
  expect(dbs.length).toEqual(0);
});


// TODO: test with completely invalid config (non-JSON)
