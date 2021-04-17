import { Result, Ok, Err } from 'seidr';
import { Storage } from './storage';
import { parse, parse2, flatten, TransactionRecord } from './parser'
import { Transaction, hledgerTransactionsSerialize } from './transaction'

export enum DatabaseState {
  Initialized,
  Missing,
  Loaded,
  Invalid,
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
      this.state = DatabaseState.Missing;
    }
  }

  async transactions(): Promise<Result<string, TransactionRecord[]>> {
    // if (this.state === DatabaseState.Loaded) {
    //   return Promise.resolve(this.transactionRecords);
    // } else if (this.state === DatabaseState.Initialized) {
    //   let data = await this.storage.readPath(this.filePath);
    //   console.log("Read file from disk");
    //   // TODO: store version
    //   this.transactionRecords = parse(data);
    //   console.log("Parsed transaction records");
    //   // TODO: fail if transaction were not loaded successfully
    //   this.state = DatabaseState.Loaded;

    //   return this.transactionRecords;
    // } else {
    //   return Promise.resolve([]);
    // }

    return this.storage.readPath(this.filePath)
      .then(data => parse2(data))
      .then(txns => Ok(txns))
      .catch(err => Err(err));
  }


  // async categoryNames(): Promise<string[]> {
  //   let txns = await this.transactions();
  //   let flatCategories: string[] = flatten(txns.map(txn => txn.postings.map(p => p.category)));

  //   return [...new Set(flatCategories)].sort();
  // }

  // async updateTransaction(id: string, record: TransactionRecord): Promise<Result<string, TransactionRecord>> {
  //   // TODO: not working because FE is still expecting amountCents
  //   return this.transactions()
  //     .then(txns => this.findTransaction(txns, id))
  //     .then(idx => this.updateTransactionByIndex(idx, record))
  //     .then(txn => Ok(txn))
  //     .catch(err => Err(err));
  // }

  private async findTransaction(txns: TransactionRecord[], id: string): Promise<number> {
    let idx = txns.findIndex(element => element.id === id);
    if (idx !== -1) {
      return Promise.resolve(idx);
    } else {
      return Promise.reject("No Record For Index");
    }
  }

  private async updateTransactionByIndex(idx: number, record: TransactionRecord): Promise<TransactionRecord> {
    return new Promise<TransactionRecord>((resolve, reject) => {
      this.transactionRecords[idx] = new Transaction(record.id, record.date, record.description, record.postings);
      this.storage.writePath(this.filePath, hledgerTransactionsSerialize(this.transactionRecords))
        .then(() => resolve(this.transactionRecords[idx]))
        .catch(err => reject(err));
    });
  }
}