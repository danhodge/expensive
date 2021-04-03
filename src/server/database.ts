import { Result, Ok, Err } from 'seidr';
import { Storage } from './storage';
import { parse, flatten, TransactionRecord } from './parser'
import { Transaction, hledgerTransactionsSerialize } from './transaction'

enum DatabaseState {
  Initialized,
  Loaded,
  Error
}

export class Database {
  state: DatabaseState;
  transactionRecords: TransactionRecord[];

  constructor(readonly filePath: string, readonly storage: Storage) {
    this.storage = storage;
    if (this.storage.exists(filePath)) {
      this.filePath = filePath;
      this.state = DatabaseState.Initialized;
    } else {
      this.state = DatabaseState.Error;
    }
  }

  async transactions(): Promise<TransactionRecord[]> {
    if (this.state === DatabaseState.Error) {
      return Promise.resolve([]);
    } else if (this.state == DatabaseState.Loaded) {
      return Promise.resolve(this.transactionRecords);
    } else {
      let data = await this.storage.readPath(this.filePath);
      console.log("Read file from disk");
      // TODO: store version
      this.transactionRecords = parse(data);
      console.log("Parsed transaction records");
      // TODO: fail if transaction were not loaded successfully
      this.state = DatabaseState.Loaded;

      return this.transactionRecords;
    }
  }

  async categoryNames(): Promise<string[]> {
    let txns = await this.transactions();
    let flatCategories: string[] = flatten(txns.map(txn => txn.postings.map(p => p.category)));

    return [...new Set(flatCategories)].sort();
  }

  async updateTransaction(id: string, record: TransactionRecord): Promise<Result<string, TransactionRecord>> {
    let txns = await this.transactions();
    let idx = txns.findIndex(element => element.id == id);

    if (idx != -1) {
      try {
        this.transactionRecords[idx] = new Transaction(id, record.date, record.description, record.postings);
        await this.storage.writePath(this.filePath, hledgerTransactionsSerialize(this.transactionRecords));

        return Ok(this.transactionRecords[idx]);
      } catch {
        return Err("Write Error");
      }
    } else {
      return Err("Record not found");
    }
  }
}
