import { NamingRules } from '../src/server/namingRules';

test("matches a rule", () => {
  const patterns = new Map<string, string>();
  patterns.set("^FOOD WRLD", "Food World");
  patterns.set(".+FFJLMCT&SON'S, llc$", "1234 Gas");

  const rules = new NamingRules(patterns);

  expect(rules.apply("FOOD WRLD N SPRINGLFD 127X")).toEqual("Food World");
  expect(rules.apply("6? DBA JJB&FFFJLMCT&SON'S, llc")).toEqual("1234 Gas");
  expect(rules.apply("GFBD&C#13 E FDBLND")).toEqual("GFBD&C#13 E FDBLND");
});