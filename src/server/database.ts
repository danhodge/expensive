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

  parseCsv(data: string): Transaction[] {
    const parser = parse({ columns: true });
    const results = new Array<Transaction>();

    parser.on('readable', () => {
      let record
      // record is an object with keys for each column and string values for each value - even if the key is not a valid variable name
      while (record = parser.read()) {
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
