import { mock, instance, when, anyFunction } from 'ts-mockito';
import { Storage } from '../src/server/storage';
import { DatabaseManager } from '../src/server/databaseManager';

test("loads the databases on demand", async () => {
  const mockStorage: Storage = mock();
  const storage: Storage = instance(mockStorage);
  when(mockStorage.scan(anyFunction())).thenResolve(['1234.expensive.json', '5678.expensive.json']);
  when(mockStorage.readPath('1234.expensive.json')).thenResolve(JSON.stringify({ "name": "test123", "journal": "1234.journal", "dataDir": "data/1234" }));
  when(mockStorage.exists('1234.journal')).thenResolve(true);

  const gen = new DatabaseManager(storage).databases();
  const result = await gen.next();

  expect(result.done).toEqual(false);
  if (result.done === false) {
    expect(result.value.name()).toEqual('test123');
  }
});
