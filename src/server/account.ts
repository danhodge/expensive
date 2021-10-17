import { CSVSpec } from './csv';

export enum AccountType {
  Credit
};

export class Account {
  constructor(
    readonly type: AccountType,
    readonly defaultSrcAccount: string,
    readonly defaultDestAccount: string,
    readonly csvSpec: CSVSpec
  ) {
  }
}
