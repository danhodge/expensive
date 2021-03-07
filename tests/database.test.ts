import { Database } from '../src/server/database';
import { TransactionRecord } from '../src/server/parser';

test("update", () => {
  let db = new Database("file.txt")
  let req: any = { date: "2021-02-21", description: "foo", postings: [] };
  let req2 = req as TransactionRecord;
  db.updateTransaction("123", req2);
});
