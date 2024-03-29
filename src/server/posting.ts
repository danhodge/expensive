import { string, int, field, map3 } from "./json"

// TODO: should change 'category' to 'account'
const postingDecoder = map3(
  (index: number, catg: string, amt: number) => new Posting(index, catg, amt),
  field("index", int()),
  field("category", string()),
  field("amountCents", int())
);
export { postingDecoder };

export class Posting {
  constructor(readonly index: number, readonly category: string, readonly amountCents: number) { }

  amount(): string {
    const dollars = Math.trunc(this.amountCents / 100);
    const cents = Math.abs(this.amountCents % 100).toString().padStart(2, "0");

    return `${dollars}.${cents}`
  }
}
