import { Streams } from '@masala/parser';
import { TransactionDate } from '../src/server/transactionDate';
import { parse, transactionDate, commentAndNewline, nonNewlineWhitespace, nonNewlineWhitespace1, posting, record, hledger, blankLine, postingDescription, amount } from '../src/server/parser'

test("date", () => {
  const r = transactionDate().parse(Streams.ofString("2020-11-13"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.year).toEqual(2020);
  expect(r.value.month).toEqual(11);
  expect(r.value.date).toEqual(13);
});

test("nonNewlineWhitespace", () => {
  const r = nonNewlineWhitespace().parse(Streams.ofString(" \t      \t   "));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual([" ", "\t", " ", " ", " ", " ", " ", " ", "\t", " ", " ", " "]);
});

test("nonNewlineWhitespace1 single whitespace character", () => {
  const r = nonNewlineWhitespace1().parse(Streams.ofString("\t"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual(["\t"]);
});

test("nonNewlineWhitespace1 multiple whitespace characters", () => {
  const r = nonNewlineWhitespace1().parse(Streams.ofString("\t  \t"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual(["\t", " ", " ", "\t"]);
});

test("nonNewlineWhitespace1 no whitespace characters", () => {
  const r = nonNewlineWhitespace1().parse(Streams.ofString(""));
  expect(r.isAccepted()).toEqual(false);
});

test("posting", () => {
  const r = posting().parse(Streams.ofString("\texpenses:food:fast food       $-1.23  ; id:123\n"));
  expect(r.isAccepted()).toEqual(true);
  // TODO: stop passing the comment into the Posting as the index
  expect(r.value).toEqual({ category: "expenses:food:fast food", amountCents: -123, index: "id:123" });
});

test("blankLine", () => {
  const r = blankLine().parse(Streams.ofString("\n"));
  expect(r.isAccepted()).toEqual(true);
});

test("blankLine with whitespace", () => {
  const r = blankLine().parse(Streams.ofString("  \t    \n"));
  expect(r.isAccepted()).toEqual(true);
});

test("commentAndNewline", () => {
  const r = commentAndNewline().parse(Streams.ofString(" \t   ; no comment\n\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.offset).toEqual(18);
  expect(r.value).toEqual({ text: "no comment" });
});

test("record", () => {
  const r = record().parse(Streams.ofString("2020-11-17 Some store\n    expenses:food:groceries     $-1.23 ; id:123\n    assets:cash        $1.23 ; id:456\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual({
    id: "1",
    date: new TransactionDate(2020, 11, 17),
    description: "Some store",
    postings: [
      { category: "expenses:food:groceries", amountCents: -123, index: 0 },
      { category: "assets:cash", amountCents: 123, index: 1 }
    ]
  });
})

test("recordWithComment", () => {
  const r = record().parse(Streams.ofString("2020-11-17 Some store  ; id:123 \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.id).toEqual("123")
})

test("recordWithNoIdComment", () => {
  const r = record().parse(Streams.ofString("2020-11-17 Some store  ; seqno:1 \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.id).toEqual("1");
})

test("recordWithIdAndNonIdComments", () => {
  const r = record().parse(Streams.ofString("2020-11-17 Some store  ; seqno:1, id:123, other:note \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.id).toEqual("123");
})

test("blanks", () => {
  const data = "\n\n\n\n\n\n\n\n\n";
  const r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("comment & blank", () => {
  const data = "; comment about nothing\n\n";
  const r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("postingDescription", () => {
  const data = "expenses:food:fruits and vegetables:organic  ";
  const r = postingDescription().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual(data.trim());
});

test("amount", () => {
  const data = "$-123.45";
  const r = amount().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual(-12345);
});

test("posting", () => {
  const data = "    expenses:unclassified                 $900.00\n";
  const r = posting().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual({ category: "expenses:unclassified", amountCents: 90000, index: null });
})

test("comment, blank & record", () => {
  const data = "2020-01-02 Credit  ; id:1234\n" +
    "    expenses:unclassified                 $-900.00\n" +
    "    liabilities:credit cards:amex         $900.00\n";

  const r = record().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("hledger", () => {
  const data = "; journal file\n" +
    "\n" +
    "2020-10-01 big stuff ; id:123\n" +
    "    expenses:import              $100.00\n" +
    "    assets:cash                 $-100.00\n";

  const r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("parse", () => {
  const data = "; journal file\n" +
    "\n" +
    "2020-10-01 big stuff ; id:123\n" +
    "    expenses:import              $100.00 ; id:456\n" +
    "    assets:cash                 $-100.00 ; id:789\n";

  const r = parse(data);
  expect(r.length).toEqual(1);
});

// test("realData", () => {
//   let data = readFileSync('test.journal').toString();
//   let r = hledger().parse(Streams.ofString(data));
//   console.log(r.value.value);
//   expect(r.isAccepted()).toEqual(true);
// });
