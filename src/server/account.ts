import { CSVSpec } from './csv';
import { Posting } from './posting';
import { NamingRules } from './namingRules';
import { PostingRules } from './postingRules';

export enum AccountType {
  Credit
}

export class Account {
  constructor(
    readonly id: string,
    readonly type: AccountType,
    readonly accountName: string,
    readonly csvSpec: CSVSpec,
    readonly namingRules: NamingRules,
    readonly postingRules: PostingRules
  ) {
  }

  rename(description: string): string {
    return this.namingRules.apply(description);
  }

  createPostings(description: string, amountCents: number): Posting[] {
    return [];
  }
}
