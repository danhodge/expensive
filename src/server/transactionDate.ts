import { string, Decoder } from "./json";
import { Result, Ok, Err } from 'seidr';

export class TransactionDate {
  // TODO: this needs to handle unparseable dates
  static parse(value: string): TransactionDate {
    const [month, date, year] = value.split("/");
    return new TransactionDate(parseInt(year), parseInt(month), parseInt(date));
  }

  constructor(readonly year: number, readonly month: number, readonly date: number) { }

  toString(): string {
    return [
      this.year.toString(),
      this.month.toString().padStart(2, "0"),
      this.date.toString().padStart(2, "0")
    ].join("-");
  }
}

export function transactionDate(): Decoder<TransactionDate> {
  return ((obj: unknown) => {
    return string()(obj).caseOf({
      Err: err => Err(err),
      Ok: str => {
        return Ok(TransactionDate.parse(str));
      }
    });
  });
}