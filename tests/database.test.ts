import { readFileSync } from 'fs';
import { instance, mock, when } from 'ts-mockito';
import { InMemoryStorage, Storage } from '../src/server/storage';
import { Database, DatabaseConfig } from '../src/server/database';
import { Posting } from '../src/server/posting';
import { Transaction } from '../src/server/transaction';
import { TransactionDate } from '../src/server/transactionDate';

async function withValidDb(config: DatabaseConfig, storage: Storage, fn: (db: Database) => void) {
  const dbResult = await Database.load(config, storage);
  dbResult.caseOf({
    Ok: async db => fn(db),
    Err: err => fail(`Expected valid db, got error ${err} instead`)
  });
}

test("successfully loads transactions from storage", async () => {
  const path = "file.journal";
  const config = new DatabaseConfig("123", "test", path, "dataDir", []);
  const data = readFileSync("tests/fixtures/single_transaction.journal");
  const storage: Storage = new InMemoryStorage();
  storage.writePath(path, data.toString());

  withValidDb(config, storage, db => { expect(Array.of(db.allTransactions()).length).toEqual(1) });
});

test("fails to load transactions from storage", async () => {
  const path = "file.journal";
  const config = new DatabaseConfig("123", "test", path, "dataDir", []);
  const mockStorage: Storage = mock();
  const storage: Storage = instance(mockStorage);
  when(mockStorage.readPath(path)).thenReject(new Error("Problem"));

  const dbResult = await Database.load(config, storage);
  dbResult.caseOf({
    Ok: () => fail("Expected failure"),
    Err: err => expect(err.toString()).toEqual("Error: Problem")
  });
});

test("fails to parse transactions from storage", async () => {
  const path = "file.journal";
  const config = new DatabaseConfig("123", "test", path, "dataDir", []);
  const storage: Storage = new InMemoryStorage();
  storage.writePath(path, "INVALID DATA");

  const dbResult = await Database.load(config, storage);
  dbResult.caseOf({
    Ok: () => fail("Expected failure"),
    Err: err => expect(err.toString()).toEqual("Parse Error")
  });
});

test("successfully writes new transaction to storage", async () => {
  const path = "file.journal";
  const config = new DatabaseConfig("123", "test", path, "dataDir", []);
  const storage: Storage = new InMemoryStorage();
  storage.writePath(path, readFileSync("tests/fixtures/single_transaction.journal").toString());

  withValidDb(config, storage, async (db) => {
    const rec = new Transaction(
      "456",
      TransactionDate.parse("4/2/2021"),
      "Quik-E-Mart",
      new Array<Posting>(
        new Posting(1, "expenses:food:squishee", 3456),
        new Posting(2, "liabilities:credit cards:visa", -3456)
      )
    );

    (await db.createTransaction(rec)).caseOf({
      Err: () => {
        fail("Expected success");
      },
      Ok: async txn => {
        expect(txn).toEqual(rec);
        //expect(await storage.readPath(path)).toEqual("stuff");
      }
    });
  });
});

test("successfully write updates to storage", async () => {
  const path = "file.journal";
  const config = new DatabaseConfig("123", "test", path, "dataDir", []);
  const data = readFileSync("tests/fixtures/single_transaction.journal");
  const storage: Storage = new InMemoryStorage();
  storage.writePath(path, data.toString());

  withValidDb(config, storage, async (db) => {
    const rec = new Transaction(
      "123",
      TransactionDate.parse("4/1/2021"),
      "Quik-E-Mart",
      new Array<Posting>(
        new Posting(1, "expenses:food:squishee", 3456),
        new Posting(2, "liabilities:credit cards:visa", -3456)
      )
    );

    (await db.updateTransaction(rec.id, rec)).caseOf({
      Err: () => {
        fail("Expected success");
      },
      Ok: async txn => {
        expect(txn).toEqual(rec);
        //expect(await storage.readPath(path)).toEqual("stuff");
      }
    });
  });
});

// TODO: implement later
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
