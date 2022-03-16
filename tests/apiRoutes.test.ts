import request from 'supertest';
import { createApp } from '../src/server/server';
import { createRoutes } from '../src/server/routes';
import { InMemoryStorage, Storage } from '../src/server/storage';
import { Account, AccountType } from '../src/server/account';
import { CSVField, CSVSpec } from '../src/server/csv';
import { DatabaseManager } from '../src/server/databaseManager';
import { DatabaseConfig } from '../src/server/database';
import { NamingRules } from '../src/server/namingRules';
import { NamingRule } from '../src/server/namingRule';

test("returns OK", async () => {
  const dbId = "123";
  const accountId = "456";
  const journal = "testdb.journal";
  const storage: Storage = new InMemoryStorage();
  const dbMgr: DatabaseManager = new DatabaseManager(storage);

  storage.writePath("testdb.journal", "; Empty Journal\n");
  const spec = new CSVSpec(new CSVField("Date"), new CSVField("Desc"), new CSVField("Amt"));
  const accountRule = new Map<string, string>();
  accountRule.set("name", "expenses:pets:food");
  const rules = new NamingRules([new NamingRule("Pet Food", ["^ABC"], [accountRule])]);
  const account = new Account(accountId, AccountType.Credit, "liabilities:credit cards:amex", spec, rules);
  await dbMgr.createDatabase(new DatabaseConfig(dbId, "testdb", journal, `data/${dbId}`, [account]));

  const app = createApp(createRoutes(dbMgr));

  const res = await request(app)
    .post(`/api/${dbId}/upload/${accountId}`)
    .send("Date,Desc,Amt\n3/8/2022,ABC,-123.45\n")
    .set('Content-Type', 'text/csv');

  expect(res.status).toEqual(200);

  const fileData = (await storage.readPath(journal)).toString();
  expect(fileData).toContain("Pet Food");
});
