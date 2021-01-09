import { Posting } from "./posting";

export class Transaction {
  constructor(readonly id: number, readonly date: Date, readonly description: string, readonly postings: Posting[]) { }
}
