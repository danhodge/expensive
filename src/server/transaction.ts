import { Posting } from "./posting";
import { TransactionRecord } from "./parser";

export class Transaction implements TransactionRecord {
  private amountCents: number;

  constructor(readonly id: string, readonly date: Date, readonly description: string, readonly postings: Posting[]) {
    this.amountCents = 0;
  }
}
