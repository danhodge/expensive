import { Posting } from "./posting";
import { TransactionRecord, description } from "./parser";

export function serialize(record: TransactionRecord) {
  return {
    id: record.id,
    date: record.date.toDateString(),
    description: record.description,
    postings: record.postings,
    amountCents: 0
  }
}

export class Transaction implements TransactionRecord {
  constructor(readonly id: string, readonly date: Date, readonly description: string, readonly postings: Posting[]) { }
}
