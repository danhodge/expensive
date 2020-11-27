import { Streams } from '@masala/parser';
import { readFileSync } from 'fs';
import { parse, date, commentAndNewline, nonNewlineWhitespace, nonNewlineWhitespace1, posting, record, hledger, blankLine, postingDescription, amount } from '../src/parser'

test("date", () => {
  let r = date().parse(Streams.ofString("2020-11-13"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual([2020, 11, 13]);
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
  let r = posting().parse(Streams.ofString("\texpenses:food:fast food       $-1.23\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.value.value).toEqual(["expenses:food:fast food", -123]);
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
  let r = commentAndNewline().parse(Streams.ofString("; no comment\n\n"));
  expect(r.isAccepted()).toEqual(true);
  expect(r.offset).toEqual(13);
});

test("record", () => {
  let r = record().parse(Streams.ofString("2020-11-17 Some store\n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
})

test("recordWithComment", () => {
  let r = record().parse(Streams.ofString("2020-11-17 Some store  ; id=123 \n    expenses:food:groceries     $-1.23\n    assets:cash        $1.23\n"));
  expect(r.isAccepted()).toEqual(true);
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
  expect(r.value.value).toEqual(["expenses:unclassified", 90000]);
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
    "2020-10-01 big stuff ; id=123\n" +
    "    expenses:import              $100.00\n" +
    "    assets:cash                 $-100.00\n";

  let r = hledger().parse(Streams.ofString(data));
  expect(r.isAccepted()).toEqual(true);
});

// test("realData", () => {
//   let data = readFileSync('test.journal').toString();
//   let r = hledger().parse(Streams.ofString(data));
//   expect(r.isAccepted()).toEqual(true);
// });
