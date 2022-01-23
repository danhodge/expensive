import { parse } from '../src/server/csv';
import { Account, AccountType } from '../src/server/account';
import { CSVField } from '../src/server/csv';
import { CSVSpec } from '../src/server/csv';
import { Posting } from '../src/server/posting';
import { NamingRules } from '../src/server/namingRules'
import { PostingRules } from '../src/server/postingRules'

test("parses CSV", () => {
  const spec = new CSVSpec(new CSVField("Transaction Date"), new CSVField("Description"), new CSVField("Amount"));
  const namingRules = new NamingRules(new Map<string, string>());
  const postingRules = new PostingRules(new Map<string, Array<string>>(), "liabilities:credit cards:amex", AccountType.Credit);
  const account = new Account(
    "bebb6a98-41ee-4a4b-8a7d-0b63fe570c56",
    AccountType.Credit,
    "liabilities:credit cards:amex",
    spec,
    namingRules,
    postingRules
  );
  const data =
    "Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n" +
    "12/30/2019,12/31/2019,RENTAL CAR,Travel,Sale,-379.71\n" +
    "01/31/2020,01/31/2020,Payment Thank You Bill Pa,,Payment,166.73,";

  const recs = parse(data, "7596f818-f6ea-445f-b702-0c437495f3cc.csv", account);

  expect(recs.length).toEqual(2);
  expect(recs[0].id).toEqual("97ca19660780de8575f2591f0222b32b");
  expect(recs[0].description).toEqual("RENTAL CAR");
  expect(recs[0].date.toString()).toEqual("2019-12-30");
  expect(recs[0].postings).toEqual([new Posting(0, "liabilities:credit cards:amex", -37971), new Posting(1, "expenses:unclassified", 37971)])

  expect(recs[1].id).toEqual("76a419494a70f305e5aa24079c573439");
  expect(recs[1].description).toEqual("Payment Thank You Bill Pa");
  expect(recs[1].date.toString()).toEqual("2020-01-31");
  expect(recs[1].postings).toEqual([new Posting(0, "expenses:unclassified", -16673), new Posting(1, "liabilities:credit cards:amex", 16673)])
});

test("indexes matching entries", () => {
  const spec = new CSVSpec(new CSVField("Transaction Date"), new CSVField("Description"), new CSVField("Amount"));
  const namingPatterns = new Map<string, string>();
  namingPatterns.set("^AIR FARE", "Budget Airwayze");
  const namingRules = new NamingRules(namingPatterns);

  const postingMappings = new Map<string, Array<string>>();
  postingMappings.set("expenses:travel:airfare", ["Budget Airwayze"]);
  const postingRules = new PostingRules(postingMappings, "liabilities:credit cards:amex", AccountType.Credit);
  const account = new Account(
    "bebb6a98-41ee-4a4b-8a7d-0b63fe570c56",
    AccountType.Credit,
    "liabilities:credit cards:amex",
    spec,
    namingRules,
    postingRules
  );
  const data =
    "Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n" +
    "10/10/2021,10/11/2021,AIR FARE,Travel,Sale,-199.12\n" +
    "10/10/2021,10/11/2021,AIR FARE,Travel,Sale,-199.12\n" +
    "10/11/2021,10/13/2021,CAT LITTER 4U,Pets,Sale,-23.12\n";

  const recs = parse(data, "7596f818-f6ea-445f-b702-0c437495f3cc.csv", account);

  expect(recs.length).toEqual(3);

  expect(recs[0].id).toEqual("3fd0eb3a282ebd6f9d78114bbc637879");
  expect(recs[0].description).toEqual("Budget Airwayze");
  expect(recs[0].date.toString()).toEqual("2021-10-10");
  expect(recs[0].postings).toEqual([new Posting(0, "liabilities:credit cards:amex", -19912), new Posting(1, "expenses:travel:airfare", 19912)])

  expect(recs[1].id).toEqual("80519a4f05ab88cc3305591c1fe45aa2");
  expect(recs[1].description).toEqual("Budget Airwayze");
  expect(recs[1].date.toString()).toEqual("2021-10-10");
  expect(recs[1].postings).toEqual([new Posting(0, "liabilities:credit cards:amex", -19912), new Posting(1, "expenses:travel:airfare", 19912)])

  expect(recs[2].id).toEqual("811759b3993fdf78b3f2f374a22803bc");
  expect(recs[2].description).toEqual("CAT LITTER 4U");
  expect(recs[2].date.toString()).toEqual("2021-10-11");
  expect(recs[2].postings).toEqual([new Posting(0, "liabilities:credit cards:amex", -2312), new Posting(1, "expenses:unclassified", 2312)])
});
