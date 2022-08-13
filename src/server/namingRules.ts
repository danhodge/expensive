import { Posting } from './posting';
import { NamingRule, namingRuleDecoder } from './namingRule';
import { Storage } from './storage';
import { array, map, Decoder, decodeString } from './json';
import { Ok, Result } from 'seidr';

const namingRulesDecoder = map(
  (rules: Array<NamingRule>) => new NamingRules(rules),
  array(namingRuleDecoder)
);
export { namingRulesDecoder };

export function namingRulesOrFileDecoder(storage: Storage): Decoder<Promise<NamingRules>> {
  return ((obj: unknown) => {
    if (typeof (obj) === 'string') {
      return Ok(NamingRules.loadOrEmpty(obj as string, storage));
    } else {
      // promise-ified version of the namingRulesDecoder - move into a common function?
      const decoder = map(
        (rules: Array<NamingRule>) => Promise.resolve(new NamingRules(rules)),
        array(namingRuleDecoder)
      );
      return decoder(obj);
    }
  });
}

export class NamingRules {
  constructor(readonly namingRules: Array<NamingRule>) { }

  static empty(): NamingRules {
    return new NamingRules([]);
  }

  static async load(filename: string, storage: Storage): Promise<Result<string, NamingRules>> {
    const rules = await storage.readPath(filename);
    return decodeString(namingRulesDecoder, rules);
  }

  // TODO: introduced this method because couldn't get the namingRulesOrFileDecoder to work with the result of the load method 
  static async loadOrEmpty(filename: string, storage: Storage): Promise<NamingRules> {
    return (await this.load(filename, storage)).caseOf({
      Ok: rules => rules,
      Err: () => this.empty()
    })
  }

  serialize(): unknown[] {
    return this.namingRules.map((rule) => rule.serialize());
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
