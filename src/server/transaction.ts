import { postingDecoder, Posting } from "./posting";
import { TransactionRecord } from "./parser";
import { string, date, field, array, map4 } from "./json"

const transactionDecoder = map4(
  (id: string, date: Date, desc: string, postings: Posting[]) => new Transaction(id, date, desc, postings),
  field("id", string()),
  field("date", date()),
  field("description", string()),
  field("postings", array(postingDecoder))
);

export { transactionDecoder };

export function serialize(record: TransactionRecord): { id: string, date: string, description: string, postings: Array<Posting> } {
  return {
    id: record.id,
    date: record.date.toDateString(),
    description: record.description,
    postings: record.postings
  }
}

export function hledgedPostingSerialize(maxCategoryLen: number): (p: Posting) => string {
  return (posting: Posting) => {
    const padAmt = maxCategoryLen + 20 - posting.category.length;
    const paddedAmt = `$${posting.amount()}`.padStart(padAmt, ' ');

    return `    ${posting.category}${paddedAmt}`
  };
}

export function hledgerTransactionSerialize(record: Transaction): string {
  const maxCategoryLen = Math.max(...record.postings.map(p => p.category.length));
  return [
    `${record.date.toISOString().substring(0, 10)} ${record.description}  ; id:${record.id}`
  ].concat(record.postings.map(hledgedPostingSerialize(maxCategoryLen))).join("\n")
}

export function hledgerTransactionsSerialize(records: TransactionRecord[]): string {
  return records.map(hledgerTransactionSerialize).join("\n\n") + "\n"
}

export class Transaction implements TransactionRecord {
  constructor(readonly id: string, readonly date: Date, readonly description: string, readonly postings: Posting[]) { }
}
