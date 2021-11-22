import { Maybe, Just, Nothing } from 'seidr';

type NamingRule = (name: string) => Maybe<string>;

export class NamingRules {
  rules: Array<NamingRule>;

  constructor(readonly patterns: Map<string, string>) {
    this.rules = new Array();
    patterns.forEach((name: string, pattern: string) => {
      const regexp = new RegExp(pattern);
      this.rules.push((str: string) => {
        if (regexp.test(str)) {
          return Just(name);
        } else {
          return Nothing();
        }
      });
    });
  }

  apply(name: string): string {
    // TODO: would be better to short-circuit once a naming rule match is hit
    const reducer = (memo: Maybe<string>, rule: NamingRule) => {
      return memo.caseOf({
        Just: newName => memo,
        Nothing: () => rule(name)
      });
    };
    
    return this.rules.reduce(reducer, Nothing()).caseOf({
      Just: newName => newName,
      Nothing: () => name
    });
  }
}