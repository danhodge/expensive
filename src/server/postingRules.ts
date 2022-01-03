import { Maybe, Just, Nothing } from 'seidr';
import { AccountType } from './account';
import { Posting } from './posting';

export class PostingRules {
  // TODO: need to handle determination of the default account for postings that don't match any rules
  // key = canonical name, value = account
  rules: Map<string, string>;

  constructor(
    readonly mappings: Map<string, Array<string>>,
    readonly accountName: string,
    readonly accountType: AccountType,
    readonly defaultBalanceAccountName: string   // do all accounts have a default balance account?
  ) {
    this.rules = new Map();
    mappings.forEach((names: string[], account: string) => {
      // TODO: detect if the same name is assigned to multiple accounts
      names.forEach((name: string) => this.rules.set(name, account));
    });
  }



  //   // maybe CSVRecord is not necessary, can just use naming & posting converters on the CSV output
  //   (amountCents < 0) ? account.defaultSrcAccount : account.defaultDestAccount,
  //   (amountCents < 0) ? account.defaultDestAccount : account.defaultSrcAccount

  //
  // +/-  | type   || src       | desc
  // -----+--------||-----------+---------------
  // -    | credit || default   | expenses:*
  // +    | credit || income:*  | default
  // -    | income || default   | assets:*
  // +    | income || what does this mean? returning salary?

  // 2021-05-15 Stuff  ; id:2020052600001
  //   expenses:food                  $4.55
  //   liabilities:visa              $-4.55
  //   expenses:food                  $4.56
  //   expenses:junk                  $1.23

  // 2021-10-10 paycheck
  //   income:salary      -$5.00
  //   assets:checking     $5.00

  // 2021-10-10 lunch
  //   expenses:food        $5.00
  //   assets:checking     -$5.00


  // TODO: maybe this should just return an array of Postings?
  // TODO: add support for automatically splitting a posting into muliple accounts
  apply(canonicalName: string, amountCents: number): Posting[] {
    const account = this.rules.get(canonicalName);
    if (account) {
      // TODO: which posting goes first by default?
      return [new Posting(0, this.accountName, amountCents), new Posting(1, account, amountCents * -1)];
    } else if (!account && amountCents < 0) {
      return [new Posting(0, this.accountName, amountCents), new Posting(1, "expenses:unclassified", amountCents * -1)];
    } else {
      return new Array();
    }
  }
}
