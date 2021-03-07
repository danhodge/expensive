import { existsSync } from 'fs'
import { readPath } from './files'
import { parse, TransactionRecord } from './parser'
import { Transaction } from './transaction'

enum DatabaseState {
  Initialized,
  Loaded,
  Error
}

export class Database {
  state: DatabaseState;
  transactionRecords: TransactionRecord[];

  constructor(readonly filePath: string) {
    if (existsSync(filePath)) {
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
      let data = await readPath(this.filePath);
      console.log("Read file from disk");
      // TODO: store version
      this.transactionRecords = parse(data);
      this.state = DatabaseState.Loaded;

      return this.transactionRecords;
    }
  }

  // TODO: properly fill in ids for new postings
  updateTransaction(id: string, record: TransactionRecord): TransactionRecord {
    let idx = this.transactionRecords.findIndex(element => element.id == id);
    if (idx != -1) {
      // TODO: store to disk
      this.transactionRecords[idx] = new Transaction(id, record.date, record.description, record.postings);
      return record;
    } else {
      // TODO: what to do on error?
      return null;
    }
  }
}
