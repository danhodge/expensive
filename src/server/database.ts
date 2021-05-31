import { Result, Ok, Err } from 'seidr';
import { Storage } from './storage';
import { parse, parse2, flatten, TransactionRecord } from './parser'
import { Transaction, hledgerTransactionsSerialize } from './transaction'
import { Decoder, string, field, map3 } from "./json"

export enum DatabaseState {
  New,
  Initialized,
  Missing,
  Loaded,
  Invalid,
  Error
}

export class DatabaseConfig {
  constructor(readonly id: string, readonly name: string, readonly journal: string, readonly dataDir: string) {
  }

  url(base: string): string {
    return [base, this.id].join("/");
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
  transactionRecords: TransactionRecord[];

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
      return Promise.resolve(Err(`Failed to load transaction: ${this.state}`));
    }
  }


  async categoryNames(): Promise<string[]> {
    // let txns = await this.transactions();
    // let flatCategories: string[] = flatten(txns.map(txn => txn.postings.map(p => p.category)));

    // return [...new Set(flatCategories)].sort();

    return ["None"];
  }

  async updateTransaction(id: string, record: TransactionRecord): Promise<Result<string, TransactionRecord>> {
    return this.transactions()
      .then(txns => this.findTransaction(txns, id))
      .then(idx => this.updateTransactionByIndex(idx, record))
      .then(txn => Ok(txn))
      .catch(err => Err(err));
  }

  private async findTransaction(result: Result<string, TransactionRecord[]>, id: string): Promise<number> {
    let idx = result.getOrElse([]).findIndex(element => element.id === id);
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
