import { Posting } from './posting';
import { NamingRule, namingRuleDecoder } from './namingRule';
import { array, map } from './json';

const namingRulesDecoder = map(
  (rules: Array<NamingRule>) => new NamingRules(rules),
  array(namingRuleDecoder)
);
export { namingRulesDecoder };

export class NamingRules {
  constructor(readonly namingRules: Array<NamingRule>) { }

  static empty(): NamingRules {
    return new NamingRules([]);
  }

  rename(name: string): string {
    const match = this.namingRules.find((rule: NamingRule) => rule.isMatch(name));
    if (match) {
      return match.description;
    } else {
      return name;
    }
  }

  createPostings(name: string, accountName: string, amountCents: number): Posting[] {
    const match = this.namingRules.find((rule: NamingRule) => rule.isMatch(name));

    if (match) {
      return match.apply(amountCents, accountName);
    } else if (amountCents < 0) {
      return [new Posting(0, accountName, amountCents), new Posting(1, "expenses:unclassified", amountCents * -1)];
    } else {
      return [new Posting(0, "expenses:unclassified", amountCents * -1), new Posting(1, accountName, amountCents)];
    }
  }
}
