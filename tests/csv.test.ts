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

  const recs = parse(data, account);

  expect(recs.length).toEqual(2);
  expect(recs[0].description).toEqual("RENTAL CAR");
  expect(recs[0].date.toString()).toEqual("2019-12-30");
  expect(recs[0].amountCents).toEqual(-37971);
  expect(recs[0].filename).toEqual("filename");
  expect(recs[0].index).toEqual(1);
  expect(recs[0].srcCategory).toEqual("liabilities:credit cards:amex");
  expect(recs[0].destCategory).toEqual("expenses:unclassified");

  expect(recs[1].description).toEqual("Payment Thank You Bill Pa");
  expect(recs[1].date.toString()).toEqual("2020-01-31");
  expect(recs[1].amountCents).toEqual(16673);
  expect(recs[1].filename).toEqual("filename");
  expect(recs[1].index).toEqual(1);
  expect(recs[1].srcCategory).toEqual("expenses:unclassified");
  expect(recs[1].destCategory).toEqual("liabilities:credit cards:amex");
});
