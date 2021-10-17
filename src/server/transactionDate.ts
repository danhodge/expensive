export class TransactionDate {
  static parse(value: string): TransactionDate {
    const [month, date, year] = value.split("/");
    return new TransactionDate(parseInt(year), parseInt(month), parseInt(date));
  }

  constructor(readonly year: number, readonly month: number, readonly date: number) { }

  toString(): String {
    return [
      this.year.toString(),
      this.month.toString().padStart(2, "0"),
      this.date.toString().padStart(2, "0")
    ].join("-");
  }
}
