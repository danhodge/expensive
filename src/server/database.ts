import { Maybe, Just, Nothing, Result, Ok, Err } from 'seidr';
import { default as parse } from 'csv-parse';
import { Storage } from './storage';
import { parse2, TransactionRecord } from './parser';
import { Transaction, hledgerTransactionsSerialize } from './transaction';
import { Decoder, string, field, map3 } from "./json";
import { Account } from "./account";
import { CSVSpec } from "./csvSpec";

export enum DatabaseState {
  New,
  Initialized,
  Missing,
  Loaded,
  Invalid,
  Error
}

export class DatabaseConfig {
  constructor(readonly id: string, readonly name: string, readonly journal: string, readonly dataDir: string, readonly accounts: Map<string, Account>) {
  }

  url(base: string): string {
    return [base, this.id].join("/");
  }

  serialize(): string {
    return JSON.stringify({ name: this.name, journal: this.journal, dataDir: this.dataDir });
  }

  csvConfigForAccount(accountId: string): Maybe<CSVSpec> {
    const account = this.accounts.get(accountId);
    if (account) {
      return Just(account.csvSpec);
    } else {
      return Nothing();
    }
  }
}

export function dbConfigDecoder(dbId: string): Decoder<DatabaseConfig> {
  return map3(
    (name: string, journal: string, dataDir: string) => new DatabaseConfig(dbId.toString(), name, journal, dataDir),
    field("name", string()),
    field("journal", string()),
    field("dataDir", string()),
  );
}

export class Database {
  state: DatabaseState;
  transactionRecords!: TransactionRecord[];

  constructor(readonly config: DatabaseConfig, readonly storage: Storage) {
    this.storage = storage;
    this.state = DatabaseState.New;
  }

  // TODO: make this smarter so checkState(Initialized) returns true when state = Loaded
  async checkState(targetState: DatabaseState): Promise<boolean> {
    if (this.state === DatabaseState.New) {
      this.state = await this.storage.exists(this.config.journal) ?
        DatabaseState.Initialized :
        DatabaseState.Missing;
    }

    return this.state === targetState;
  }

  id(): string {
    return this.config.id;
  }

  name(): string {
    return this.config.name;
  }

  url(base: string): string {
    return this.config.url(base);
  }

  // parse pipeline
  // raw csv -> records -> renaming rules -> combining -> filtering -> transactions
  //   question - where/how do accounts get automatically assigned? that probably needs to happen after combining?
  //
  // [ string -> string -> Account -> CSVRecord[] ] -> CSVRecord[] -> CSVRecord[] -> CSVRecord[] - > Transaction[]
  //
  // CSVKey(account_id, date, raw_description, amount, index)
  //
  // 1. parse string into CSVRecord[] with descFn: (desc: string) => string
  // 2. transform into Transaction[] using postFn (csvRecord: rec) => Posting[]
  // 3. filter?
  //
  // metadata
  //   id:<MD5(account_id, date, raw_description, amount, index)>
  //   filename:? the same transaction id will appear in multiple files, filename is really just the first file it was seen in - still useful for grouping by imported at
  //   import_id: the same info as filename, but makes it easier to attach metadata to it (where does this metadata live? database config? now it's a database, not just config...)
  //
  // Rules
  // DatabaseConfig.Account.accountName - specifies account1
  // Rules specify accounts2-N
  //
  // 03/11/2021,03/12/2021,STUFF,Shopping,Sale,-3.00,
  // account1 = liabilities:credit cards:visa
  // if sign is negative (credit), money was moving out of the credit card account (i.e. a purchase), so account1 amount is negative, and the balancing positive amount goes to expenses:unclassified or whatever rule(s) are matched
  // if sign is positive (debit), money was moving into the credit card account (i.e. paying down balance) so account1 amount is positive and the balancing negative amount goes to income:unknown or whatever rule(s) are matched
  //   note: maybe - positive amounts in credit accounts can either be income (a refund) or a transfer (coming from assets) - difficult to make a "default" choice for things without rules
  //
  // Notes: https://hledger.org/faq.html#why-are-revenues-liabilities-equity-negative-
  // source account = the account that the money was subtracted from (the credit)
  // destination account = the account that the money was added to (the debit)



  parseCsv(data: string): Transaction[] {
    const parser = parse({ columns: true });
    const results = new Array<Transaction>();

    parser.on('readable', () => {
      let record
      // record is an object with keys for each column and string values for each value - even if the key is not a valid variable name
      while ((record = parser.read())) {
        results.push(record)
      }
    });

    parser.write(data);
    parser.end();

    return results;
  }

  // csvConfigForAccount(accountId: string): CSVSpec {
  //   return this.config.csvConfigForAccount(accountId);
  // }

  async transactions(): Promise<Result<string, TransactionRecord[]>> {
    if (this.state === DatabaseState.Loaded) {
      return Promise.resolve(Ok(this.transactionRecords));
    } else if (this.state === DatabaseState.Initialized) {
      return this.storage.readPath(this.config.journal)
        .then(data => parse2(data))
        .then(txns => {
          this.transactionRecords = txns;
          this.state = DatabaseState.Loaded;

          return Ok(txns);
        })
        .catch(err => {
          if (err === "Parse Error") {
            // TODO: better way to distinguish between errors
            this.state = DatabaseState.Invalid;
          } else {
            this.state = DatabaseState.Error;
          }
          return Err(err);
        });
    } else {
      return Promise.resolve(Err(`Failed to load transactions: ${this.state}`));
    }
  }

  async updateTransaction(id: string, record: TransactionRecord): Promise<Result<string, TransactionRecord>> {
    return this.transactions()
      .then(txns => this.findTransaction(txns, id))
      .then(idx => this.updateTransactionByIndex(idx, record))
      .then(txn => Ok(txn))
      .catch(err => Err(err));
  }

  private async findTransaction(result: Result<string, TransactionRecord[]>, id: string): Promise<number> {
    const idx = result.getOrElse([]).findIndex(element => element.id === id);
    if (idx !== -1) {
      return Promise.resolve(idx);
    } else {
      return Promise.reject("No Record For Index");
    }
  }

  private async updateTransactionByIndex(idx: number, record: TransactionRecord): Promise<TransactionRecord> {
    return new Promise<TransactionRecord>((resolve, reject) => {
      this.transactionRecords[idx] = new Transaction(record.id, record.date, record.description, record.postings);
      this.storage.writePath(this.config.journal, hledgerTransactionsSerialize(this.transactionRecords))
        .then(() => resolve(this.transactionRecords[idx]))
        .catch(err => reject(err));
    });
  }
}
