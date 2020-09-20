import { Posting } from "./posting";

export class Transaction {
  constructor(readonly id: number, readonly date: string, readonly amountCents: number, readonly description: string, readonly postings: Posting[]) {}
}