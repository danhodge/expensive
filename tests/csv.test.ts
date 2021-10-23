import { parse } from '../src/server/csv';
import { Account, AccountType } from '../src/server/account';
import { CSVField } from '../src/server/csv';
import { CSVSpec } from '../src/server/csv';

test("parses CSV", () => {
  const spec = new CSVSpec(new CSVField("Transaction Date"), new CSVField("Description"), new CSVField("Amount"));
  const account = new Account(
    AccountType.Credit,
    "liabilities:credit cards:amex",
    "expenses:unclassified",
    spec
  );
  const data =
    "Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n" +
    "12/30/2019,12/31/2019,RENTAL CAR,Travel,Sale,-379.71\n" +
    "01/31/2020,01/31/2020,Payment Thank You Bill Pa,,Payment,166.73,";

  const recs = parse(data, "7596f818-f6ea-445f-b702-0c437495f3cc.csv", account);

  expect(recs.length).toEqual(2);
  expect(recs[0].description).toEqual("RENTAL CAR");
  expect(recs[0].date.toString()).toEqual("2019-12-30");
  expect(recs[0].amountCents).toEqual(-37971);
  expect(recs[0].filename).toEqual("7596f818-f6ea-445f-b702-0c437495f3cc.csv");
  expect(recs[0].index).toEqual(1);
  expect(recs[0].srcCategory).toEqual("liabilities:credit cards:amex");
  expect(recs[0].destCategory).toEqual("expenses:unclassified");

  expect(recs[1].description).toEqual("Payment Thank You Bill Pa");
  expect(recs[1].date.toString()).toEqual("2020-01-31");
  expect(recs[1].amountCents).toEqual(16673);
  expect(recs[1].filename).toEqual("7596f818-f6ea-445f-b702-0c437495f3cc.csv");
  expect(recs[1].index).toEqual(1);
  expect(recs[1].srcCategory).toEqual("expenses:unclassified");
  expect(recs[1].destCategory).toEqual("liabilities:credit cards:amex");
});

test("indexes matching entries", () => {
  const spec = new CSVSpec(new CSVField("Transaction Date"), new CSVField("Description"), new CSVField("Amount"));
  const account = new Account(
    AccountType.Credit,
    "liabilities:credit cards:amex",
    "expenses:unclassified",
    spec
  );
  const data =
    "Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n" +
    "10/10/2021,10/11/2021,AIR FARE,Travel,Sale,-199.12\n" +
    "10/10/2021,10/11/2021,AIR FARE,Travel,Sale,-199.12\n" +
    "10/11/2021,10/13/2021,CAT LITTER 4U,Pets,Sale,-23.12\n";

  const recs = parse(data, "7596f818-f6ea-445f-b702-0c437495f3cc.csv", account);

  expect(recs.length).toEqual(3);

  expect(recs[0].description).toEqual("AIR FARE");
  expect(recs[0].date.toString()).toEqual("2021-10-10");
  expect(recs[0].amountCents).toEqual(-19912);
  expect(recs[0].filename).toEqual("7596f818-f6ea-445f-b702-0c437495f3cc.csv");
  expect(recs[0].index).toEqual(1);
  expect(recs[0].srcCategory).toEqual("liabilities:credit cards:amex");
  expect(recs[0].destCategory).toEqual("expenses:unclassified");

  expect(recs[1].description).toEqual("AIR FARE");
  expect(recs[1].date.toString()).toEqual("2021-10-10");
  expect(recs[1].amountCents).toEqual(-19912);
  expect(recs[1].filename).toEqual("7596f818-f6ea-445f-b702-0c437495f3cc.csv");
  expect(recs[1].index).toEqual(2);
  expect(recs[1].srcCategory).toEqual("liabilities:credit cards:amex");
  expect(recs[1].destCategory).toEqual("expenses:unclassified");

  expect(recs[2].description).toEqual("CAT LITTER 4U");
  expect(recs[2].date.toString()).toEqual("2021-10-11");
  expect(recs[2].amountCents).toEqual(-2312);
  expect(recs[2].filename).toEqual("7596f818-f6ea-445f-b702-0c437495f3cc.csv");
  expect(recs[2].index).toEqual(1);
  expect(recs[2].srcCategory).toEqual("liabilities:credit cards:amex");
  expect(recs[2].destCategory).toEqual("expenses:unclassified");
});
