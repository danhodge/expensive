import { CSVSpec } from './csv';
import { Posting } from './posting';
import { NamingRules } from './namingRules';

export enum AccountType {
  Credit
}

export class Account {
  constructor(
    readonly type: AccountType,
    readonly accountName: string,
    readonly csvSpec: CSVSpec,
    readonly namingRules: NamingRules,
    readonly postingRules: PostingRules
  ) {
  }

  rename(description: string): string {
    return description;
  }

  postings(description: string, amountCents: number): Posting[] {
    return [];
  }
}
