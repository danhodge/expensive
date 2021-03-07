import { postingDecoder, Posting } from "./posting";
import { TransactionRecord, description } from "./parser";
import { string, date, field, array, map4 } from "./json"

const transactionDecoder = map4(
  (id: string, date: Date, desc: string, postings: Posting[]) => new Transaction(id, date, desc, postings),
  field("id", string()),
  field("date", date()),
  field("description", string()),
  field("postings", array(postingDecoder))
);

export { transactionDecoder };

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

  // https://www.typescriptlang.org/docs/handbook/advanced-types.html
  static fromJSON(json: any): Transaction {
    let date = new Date(Date.parse(json.date));
    return new Transaction(json.id, date, json.description, json.postings);
  }
}
