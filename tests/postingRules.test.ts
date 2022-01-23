import { AccountType } from '../src/server/account';
import { Posting } from '../src/server/posting';
import { PostingRules } from '../src/server/postingRules';

test("handles an expense that is mapped successfully", () => {
  const mappings = new Map<string, Array<string>>();
  const accountName = "liabilities:credit card:amex";
  mappings.set("expenses:food:groceries", ["Food World"]);
  const rules = new PostingRules(mappings, accountName, AccountType.Credit);

  expect(rules.apply("Food World", -123)).toEqual([new Posting(0, accountName, -123), new Posting(1, "expenses:food:groceries", 123)]);
});

test("handles an expense that is not mapped successfully", () => {
  const mappings = new Map<string, Array<string>>();
  const accountName = "liabilities:credit card:amex";
  mappings.set("expenses:food:groceries", ["Food World"]);
  const rules = new PostingRules(mappings, accountName, AccountType.Credit);

  expect(rules.apply("GRCRY STRE 123", -456)).toEqual([new Posting(0, accountName, -456), new Posting(1, "expenses:unclassified", 456)]);
});

test("handles income that is mapped successfully", () => {
  const mappings = new Map<string, Array<string>>();
  const accountName = "liabilities:credit card:amex";
  mappings.set("expenses:food:groceries", ["Food World"]);
  const rules = new PostingRules(mappings, accountName, AccountType.Credit);

  expect(rules.apply("Food World", 456)).toEqual([new Posting(0, "expenses:food:groceries", -456), new Posting(1, accountName, 456)]);
});

test("handles income that is not mapped successfully", () => {
  const mappings = new Map<string, Array<string>>();
  const accountName = "liabilities:credit card:amex";
  mappings.set("expenses:food:groceries", ["Food World"]);
  const rules = new PostingRules(mappings, accountName, AccountType.Credit);

  expect(rules.apply("GRCRY STRE 123", 456)).toEqual([new Posting(0, "expenses:unclassified", -456), new Posting(1, accountName, 456)]);
});
