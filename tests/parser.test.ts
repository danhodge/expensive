import { Streams } from '@masala/parser';
import { readFileSync } from 'fs';
import { parse, date, commentAndNewline, nonNewlineWhitespace, nonNewlineWhitespace1, posting, record, hledger, blankLine, postingDescription, amount } from '../src/server/parser'

test("date", () => {
  let r = date().parse(Streams.ofString("2020-11-13"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual(new Date(Date.parse("2020-11-13")));
});

test("nonNewlineWhitespace", () => {
  let r = nonNewlineWhitespace().parse(Streams.ofString(" \t      \t   "));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual([" ", "\t", " ", " ", " ", " ", " ", " ", "\t", " ", " ", " "]);
});

test("nonNewlineWhitespace1 single whitespace character", () => {
  let r = nonNewlineWhitespace1().parse(Streams.ofString("\t"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual(["\t"]);
});

test("nonNewlineWhitespace1 multiple whitespace characters", () => {
  let r = nonNewlineWhitespace1().parse(Streams.ofString("\t  \t"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual(["\t", " ", " ", "\t"]);
});

test("nonNewlineWhitespace1 no whitespace characters", () => {
  let r = nonNewlineWhitespace1().parse(Streams.ofString(""));
  expect(r.isAccepted()).toEqual(false);
});

test("posting", () => {
  let r = posting().parse(Streams.ofString("\texpenses:food:fast food       $-1.23  ; id:123\n"));
  expect(r.isAccepted()).toEqual(true);
  // TODO: stop passing the comment into the Posting as the index
  expect(r.value).toEqual({ category: "expenses:food:fast food", amountCents: -123, index: "id:123" });
});

test("blankLine", () => {
  let r = blankLine().parse(Streams.ofString("\n"));
  expect(r.isAccepted()).toEqual(true);
});

test("blankLine with whitespace", () => {
  let r = blankLine().parse(Streams.ofString("  \t    \n"));
  expect(r.isAccepted()).toEqual(true);
});

test("commentAndNewline", () => {
  let r = commentAndNewline().parse(Streams.ofString(" \t   ; no comment\n\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.offset).toEqual(18);
  expect(r.value).toEqual({ text: "no comment" });
});

test("record", () => {
  let r = record().parse(Streams.ofString("2020-11-17 Some store\n    expenses:food:groceries     $-1.23 ; id:123\n    assets:cash        $1.23 ; id:456\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual({
    id: "1",
    date: new Date(Date.parse("2020-11-17")),
    description: "Some store",
    postings: [
      { category: "expenses:food:groceries", amountCents: -123, index: 0 },
      { category: "assets:cash", amountCents: 123, index: 1 }
    ]
  });
})

test("recordWithComment", () => {
  let r = record().parse(Streams.ofString("2020-11-17 Some store  ; id:123 \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.id).toEqual("123")
})

test("recordWithNoIdComment", () => {
  let r = record().parse(Streams.ofString("2020-11-17 Some store  ; seqno:1 \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.id).toEqual("1");
})

test("recordWithIdAndNonIdComments", () => {
  let r = record().parse(Streams.ofString("2020-11-17 Some store  ; seqno:1, id:123, other:note \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.id).toEqual("123");
})

test("blanks", () => {
  let data = "\n\n\n\n\n\n\n\n\n";
  let r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("comment & blank", () => {
  let data = "; comment about nothing\n\n";
  let r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("postingDescription", () => {
  let data = "expenses:food:fruits and vegetables:organic  ";
  let r = postingDescription().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual(data.trim());
});

test("amount", () => {
  let data = "$-123.45";
  let r = amount().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual(-12345);
});

test("posting", () => {
  let data = "    expenses:unclassified                 $900.00\n";
  let r = posting().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value).toEqual({ category: "expenses:unclassified", amountCents: 90000, index: null });
})

test("comment, blank & record", () => {
  let data = "2020-01-02 Credit  ; id:1234\n" +
    "    expenses:unclassified                 $-900.00\n" +
    "    liabilities:credit cards:amex         $900.00\n";

  let r = record().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("hledger", () => {
  let data = "; journal file\n" +
    "\n" +
    "2020-10-01 big stuff ; id:123\n" +
    "    expenses:import              $100.00\n" +
    "    assets:cash                 $-100.00\n";

  let r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

test("parse", () => {
  let data = "; journal file\n" +
    "\n" +
    "2020-10-01 big stuff ; id:123\n" +
    "    expenses:import              $100.00 ; id:456\n" +
    "    assets:cash                 $-100.00 ; id:789\n";

  let r = parse(data);
  expect(r.length).toEqual(1);
});

// test("realData", () => {
//   let data = readFileSync('test.journal').toString();
//   let r = hledger().parse(Streams.ofString(data));
//   console.log(r.value.value);
//   expect(r.isAccepted()).toEqual(true);
// });
