import { NamingRule } from '../src/server/namingRule';
import { NamingRules } from '../src/server/namingRules';
import { Posting } from '../src/server/posting';

test("matches a rule", () => {
  const patterns = new Array<NamingRule>();
  patterns.push(new NamingRule("Food World", ["^FOOD WRLD"], []));
  patterns.push(new NamingRule("1234 Gas", [".+FFJLMCT&SON'S, llc$"], []));
  const rules = new NamingRules(patterns);

  expect(rules.rename("FOOD WRLD N SPRINGLFD 127X")).toEqual("Food World");
  expect(rules.rename("6? DBA JJB&FFFJLMCT&SON'S, llc")).toEqual("1234 Gas");
  expect(rules.rename("GFBD&C#13 E FDBLND")).toEqual("GFBD&C#13 E FDBLND");
});

test("handles an expense that is mapped successfully", () => {
  const patterns = new Array<NamingRule>();
  const account = new Map<string, string>();
  const accountName = "liabilities:credit:amex";
  account.set("name", "expenses:food:groceries");
  patterns.push(new NamingRule("Food World", ["^FOOD WRLD"], [account]));
  const rules = new NamingRules(patterns);

  expect(rules.createPostings("FOOD WRLD S SPRNGFLD A1D", accountName, -123)).toEqual([new Posting(0, accountName, -123), new Posting(1, "expenses:food:groceries", 123)]);
});

test("handles an expense that is not mapped successfully", () => {
  const accountName = "liabilities:credit:amex";
  const rules = new NamingRules([]);

  expect(rules.createPostings("GRCRY STRE 123", accountName, -456)).toEqual([new Posting(0, accountName, -456), new Posting(1, "expenses:unclassified", 456)]);
});

test("handles income that is mapped successfully", () => {
  const patterns = new Array<NamingRule>();
  const account = new Map<string, string>();
  const accountName = "liabilities:credit:amex";
  account.set("name", "expenses:food:groceries");
  patterns.push(new NamingRule("Food World", ["^FOOD WRLD"], [account]));
  const rules = new NamingRules(patterns);

  expect(rules.createPostings("FOOD WRLD 1A6", accountName, 456)).toEqual([new Posting(0, "expenses:food:groceries", -456), new Posting(1, accountName, 456)]);
});

test("handles income that is not mapped successfully", () => {
  const accountName = "liabilities:credit:amex";
  const rules = new NamingRules([]);

  expect(rules.createPostings("GRCRY STRE 123", accountName, 456)).toEqual([new Posting(0, "expenses:unclassified", -456), new Posting(1, accountName, 456)]);
});
