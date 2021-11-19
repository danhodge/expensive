import { CSVSpec } from './csv';
import { Posting } from './posting';

export enum AccountType {
  Credit
}

export class Account {
  constructor(
    readonly type: AccountType,
    readonly defaultSrcAccount: string,
    readonly defaultDestAccount: string,
    readonly csvSpec: CSVSpec
  ) {
  }

  rename(description: string): string {
    return description;
  }

  postings(description: string, amountCents: number): Posting[] {
    return [];
  }
}
