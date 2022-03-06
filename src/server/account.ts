import { Ok, Err } from 'seidr';
import { CSVSpec, csvSpecDecoder } from './csv';
import { Decoder, string, int, field, map5, decode } from "./json"
import { Posting } from './posting';
import { NamingRules, namingRulesDecoder } from './namingRules';

function accountTypeDecoder(): Decoder<AccountType> {
  return ((obj: unknown) => {
    return decode(obj, int(), (val: number) => {
      if (val in AccountType) {
        return Ok(val);
      } else {
        return Err(`${val} is not a valid AccountType`);
      }
    });
  });
}

const accountDecoder = map5(
  (id: string, type: AccountType, accountName: string, csvSpec: CSVSpec, namingRules: NamingRules) => new Account(id, type, accountName, csvSpec, namingRules),
  field("id", string()),
  field("type", accountTypeDecoder()),
  field("accountName", string()),
  field("csvSpec", csvSpecDecoder),
  field("namingRules", namingRulesDecoder)
);
export { accountDecoder };

export enum AccountType {
  Credit
}

export class Account {
  constructor(
    readonly id: string,
    readonly type: AccountType,
    readonly accountName: string,
    readonly csvSpec: CSVSpec,
    readonly namingRules: NamingRules
  ) {
  }

  rename(description: string): string {
    return this.namingRules.rename(description);
  }

  createPostings(description: string, accountName: string, amountCents: number): Posting[] {
    return this.namingRules.createPostings(description, accountName, amountCents);
  }
}
