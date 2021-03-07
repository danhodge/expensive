import { string, int, field, map3 } from "./json"

const postingDecoder = map3(
  (id: number, catg: string, amt: number) => new Posting(id, catg, amt),
  field("id", int()),
  field("category", string()),
  field("amountCents", int())
);
export { postingDecoder };

export class Posting {
  constructor(readonly id: number, readonly category: string, readonly amountCents: number) { }
}
