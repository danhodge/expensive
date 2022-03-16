import { SumType } from 'sums-up';
import { Just, Maybe, Nothing } from 'seidr';
import { Posting } from './posting';
import { filterMap } from './parser';
import { array, field, map3, maybe, string } from './json';

class AccountRuleDefinition extends SumType<{
  Amount: [number],
  Percentage: [number],
  Remainder: []
}> { }

class AccountRule {
  constructor(readonly name: string, readonly definition: AccountRuleDefinition) { }

  serialize(): { name: string, amount?: string, pct?: string } {
    const result: { name: string, amount?: string, pct?: string } = { name: this.name };
    this.definition.caseOf({
      Amount: amt => result.amount = amt.toString(),
      Percentage: pct => result.pct = pct.toString(),
      Remainder: () => "ignore"
    });

    return result;
  }

  portion(remainder: number): number {
    return this.definition.caseOf({
      Amount: amt => amt,
      Percentage: pct => pct * remainder,
      Remainder: () => remainder
    });
  }
}

const accountsDecoder = map3(
  (name: string, amount: Maybe<string>, percentage: Maybe<string>) => {
    const result = new Map<string, string>();
    result.set("name", name);
    amount.map((val: string) => result.set("amount", val));
    percentage.map((val: string) => result.set("percentage", val));

    return result;
  },
  field("name", string()),
  maybe(field("amount", string())),
  maybe(field("percentage", string()))
);

const namingRuleDecoder = map3(
  (description: string, patterns: Array<string>, accounts: Array<Map<string, string>>) => new NamingRule(description, patterns, accounts),
  field("description", string()),
  field("patterns", array(string())),  // TODO: parse into regex
  field("accounts", array(accountsDecoder))
);
export { namingRuleDecoder };

export class NamingRule {
  rules: Array<RegExp>;
  accountRules: Array<AccountRule>;

  constructor(
    readonly description: string,
    readonly patterns: Array<string>,
    readonly accounts: Array<Map<string, string>>) {
    this.rules = patterns.map((pattern: string) => new RegExp(pattern));
    this.accountRules = filterMap(accounts, (rule: Map<string, string>, index: number) => {
      const isLastRule = (index + 1) === accounts.length;
      const name = rule.get("name");
      const amount = rule.get("amount");
      const pct = rule.get("pct");

      if (name && (amount && !pct)) {
        const amountCents = parseInt(amount, 10);
        return Just(new AccountRule(name, new AccountRuleDefinition("Amount", amountCents)));
      } else if (name && ((pct && !amount) || isLastRule)) {
        if (!pct) {
          return Just(new AccountRule(name, new AccountRuleDefinition("Remainder")));
        } else {
          const percentage = (!pct) ? 1 : parseFloat(pct);
          return Just(new AccountRule(name, new AccountRuleDefinition("Percentage", percentage)));
        }
      } else {
        return Nothing();
      }
    });
  }

  serialize(): { description: string, patterns: string[], accounts: unknown[] } {
    return {
      description: this.description,
      patterns: this.rules.map((pat) => pat.source),
      accounts: this.accountRules.map((rule) => rule.serialize())
    }
  }

  isMatch(name: string): boolean {
    const match = this.rules.find((pattern: RegExp) => pattern.test(name));
    return match !== undefined;
  }

  apply(amountCents: number, accountName: string): Posting[] {
    let remainder = amountCents * -1;  // TODO: what to do if remainder is not zero at end?

    if (amountCents < 0) {
      // TODO: which posting goes first by default?
      const postings = new Array<Posting>();
      postings.push(new Posting(0, accountName, amountCents));

      this.accountRules.forEach((rule: AccountRule, index: number) => {
        const amt = rule.portion(remainder);
        remainder -= amt;
        postings.push(new Posting(index + 1, rule.name, amt));
      });

      return postings;
    } else {
      const postings = this.accountRules.map((rule: AccountRule, index: number) => {
        const amt = rule.portion(remainder);
        remainder -= amt;
        return new Posting(index, rule.name, amt);
      });
      postings.push(new Posting(this.accountRules.length, accountName, amountCents));

      return postings;
    }
  }
}
