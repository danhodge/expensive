import { readFileSync } from 'fs';
import { mock, instance, when, anyString } from 'ts-mockito';
import { Storage } from '../src/server/storage';
import { Database, DatabaseState } from '../src/server/database';
import { Transaction } from '../src/server/transaction';

test("successfully loads transactions from storage", async () => {
  let path = "file.txt";
  let data = readFileSync("tests/fixtures/single_transaction.journal");
  const mockStorage: Storage = mock();
  let storage: Storage = instance(mockStorage);
  when(mockStorage.exists(path)).thenResolve(true);
  when(mockStorage.readPath(path)).thenResolve(data.toString());

  let db = new Database(path, storage);
  (await db.transactions()).caseOf({
    Err: _ => {
      fail("Expected success");
    },
    Ok: txns => {
      expect(txns.length).toEqual(1);
      expect(db.state).toEqual(DatabaseState.Loaded);
    }
  });
});

test("fails to load transactions from storage", async () => {
  let path = "file.txt";
  const mockStorage: Storage = mock();
  let storage: Storage = instance(mockStorage);
  when(mockStorage.exists(path)).thenResolve(true);
  when(mockStorage.readPath(path)).thenReject(new Error("Problem"));

  let db = new Database(path, storage);
  (await db.transactions()).caseOf({
    Err: err => {
      expect(err.toString()).toEqual("Error: Problem");
      expect(db.state).toEqual(DatabaseState.Error);
    },
    Ok: _ => {
      fail("Expected failure");
    }
  });
});

test("fails to parse transactions from storage", async () => {
  let path = "file.txt";
  const mockStorage: Storage = mock();
  let storage: Storage = instance(mockStorage);
  when(mockStorage.exists(path)).thenResolve(true);
  when(mockStorage.readPath(path)).thenResolve("INVALID DATA");

  let db = new Database(path, storage);
  (await db.transactions()).caseOf({
    Err: err => {
      expect(err.toString()).toEqual("Parse Error");
      expect(db.state).toEqual(DatabaseState.Invalid);
    },
    Ok: _ => {
      fail("Expected failure");
    }
  });
});

test("successfully write updates to storage", () => {
  //
});

// test("failure to write updates to storage", async () => {
//   let path = "file.txt";
//   let data = readFileSync("tests/fixtures/single_transaction.journal");
//   const mockStorage: Storage = mock();
//   let storage: Storage = instance(mockStorage);
//   when(mockStorage.exists(path)).thenResolve(true);
//   when(mockStorage.readPath(path)).thenResolve(data.toString());
//   when(mockStorage.writePath(path, anyString())).thenReject(new Error("Problem"));

//   let db = new Database(path, storage);
//   let req = new Transaction("123", new Date(), "Stuff", []);
//   (await db.updateTransaction(req.id, req)).caseOf({
//     Err: err => {
//       expect(err.toString()).toEqual("Error: Problem");
//     },
//     Ok: _ => {
//       fail("Expected update to fail");
//     }
//   });
// });
