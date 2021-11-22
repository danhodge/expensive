import { default as csvParse } from 'csv-parse';
import { Account } from './account';
import { TransactionDate } from './transactionDate';
import { Transaction } from './transaction';

export class CSVField {
  constructor(readonly field: string, readonly format?: string) {
  }
}

export class CSVSpec {
  constructor(readonly date: CSVField, readonly description: CSVField, readonly amount: CSVField) {
  }
}

// can filters split a record into multiple records
// type CSVRecordFilter = (records: CSVRecord[]) => CSVRecord[];

// date, description, amount, filename, raw_data, position, src_category, dest_category
// TODO: what is meant by source & dest?
//
// credit card account
//   all transactions will include category = liabilities:credit card:card
//   most transactions will have a negative value for this category
//   for most transactions, the source account is liabilities:credit card:card and the destination account varies (based on where you are spending)
//   when source account is not liabilities:credit card:card, it is the dest account & src account needs to be set to something else...
//   - can use a rule to define the src account for regular events like paying off the balance
//   - default is to assign it to an unknown asset category
//
// checking account
//   all transactions will include category = assets:checking:account
//   most transactions will have a negative value for this category
//   for most transactions, the source account is assets:checking:account and the destination account varies (based on where you are spending)
//
// payroll system
//   all transactions will include category = income:salary
//   most transactions will have a negative value for this category
//   for most transactions, the source account is income:salary and the the destination account varies (based on where the money is going)
//
// Money In = revenue
// Money Out = expenses
// credits are negative, debits are positive
// in a transactions, money is subtracted from the source account and added to the dest account
// e.g. getting paid, you subtract money from your salary account and add it to your checking account
// buying something with cash - subtract money from your cash account and add it to the relevant expense account(s)
// buying something with credit - subtract money from your credit card account and add it to the relevant expense account(s)
// paying down a credit balance from checking - subtract money from your checking account and add it to the credit card account
//
// TODO: how to handle ID assignment for transactions that show up in multiple places? i.e. paying credit card bill from checking account?
// - use a special rule that detects them and merges the transactions, similar to the paycheck splitting problem
//
export class CSVRecord {
  index: number;
  description: string;

  constructor(
    readonly date: TransactionDate,
    readonly rawDescription: string,
    readonly amountCents: number,
    readonly filename: string,
    //readonly rawData: string,     // csv-parse does not expose the raw data and reconstructing it is too difficult, would need to do something weird like pre-process the raw data
    readonly srcCategory: string,
    readonly destCategory: string
  ) {
    this.index = 0;
    this.description = rawDescription;
  }

  // records from the same file with the same date, desc, amount are differentiated using the index
  setIndex(index: number): void {
    this.index = index;
  }

  indexKey(): string {
    return [this.date.toString, this.description, this.amountCents].join("_");
  }
}

export function parse(data: string, filename: string, account: Account): Transaction[] {
  const parser = csvParse({ columns: true, relax_column_count: true });
  const records = new Array<Transaction>();

  parser.on('readable', () => {
    const groupings = new Map<string, number>();
    let record;
    // record is an object with keys for each column and string values for each value - even if the key is not a valid variable name
    while ((record = parser.read())) {
      const amountCents = Number(record[account.csvSpec.amount.field]) * 100;
      const rawDescription = record[account.csvSpec.description.field];
      const date = TransactionDate.parse(record[account.csvSpec.date.field]);
      const canonicalDescription = account.rename(rawDescription);
      const indexKey = [date.toString, rawDescription, amountCents].join("_");
      const idMaterial = [account.id, indexKey, indexCount(groupings, indexKey)].join("_");

      const txn = new Transaction(
        "MD5<idMaterial>", 
        TransactionDate.parse(record[account.csvSpec.date.field]),
        canonicalDescription, 
        account.createPostings(canonicalDescription, amountCents)
      );
   
      records.push(txn);

      // const csvRecord = new CSVRecord(
      //   TransactionDate.parse(record[account.csvSpec.date.field]),
      //   account.rename(record[account.csvSpec.description.field]),
      //   amountCents,
      //   filename,
      //   // maybe CSVRecord is not necessary, can just use naming & posting converters on the CSV output
      //   (amountCents < 0) ? account.defaultSrcAccount : account.defaultDestAccount,
      //   (amountCents < 0) ? account.defaultDestAccount : account.defaultSrcAccount
      // );
      // csvRecord.setIndex(indexCount(groupings, csvRecord.indexKey()));
      // records.push(csvRecord);
    }
  });

  parser.write(data);
  parser.end();

  return records;
}

function indexCount<T>(map: Map<T, number>, key: T): number {
  let curCount = map.get(key);
  if (!curCount) {
    curCount = 0;
  }

  const nextCount = curCount + 1;
  map.set(key, nextCount);

  return nextCount;
}

// export function composeFilters(filters: CSVRecordFilter[]): CSVRecordFilter {
//   return (records: CSVRecord[]) => {

//   };
// }

// export function process(records: CSVRecord[], filter: CSVRecordFilter): Transaction[] {

// }
