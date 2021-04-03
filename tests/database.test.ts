import { readFileSync } from 'fs';
import { mock, instance, when, anyString } from 'ts-mockito';
import { Storage } from '../src/server/storage';
import { Database } from '../src/server/database';
import { Transaction } from '../src/server/transaction';

test("successfully write updates to file", () => {
  //
});

test("failure to write updates to file", async () => {
  let path = "file.txt";
  let data = readFileSync("tests/fixtures/single_transaction.journal");
  const mockStorage: Storage = mock();
  let storage: Storage = instance(mockStorage);
  when(mockStorage.exists(path)).thenResolve(true);
  when(mockStorage.readPath(path)).thenResolve(data.toString());
  when(mockStorage.writePath(path, anyString())).thenReject(new Error("Problem"));

  let db = new Database(path, storage);
  let req = new Transaction("123", new Date(), "Stuff", []);
  (await db.updateTransaction(req.id, req)).caseOf({
    Err: err => {
      expect(err).toEqual("Write Error");
    },
    Ok: _ => {
      fail("Expected update to fail");
    }
  });
});
