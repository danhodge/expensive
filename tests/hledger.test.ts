import { Token, tokenType, tokenize, Description, Posting, decodeLine } from '../src/hledger'
import * as memoryStreams from 'memory-streams'

function nextToken(tokenIter: Generator<Token>): Token {
  const cur: IteratorResult<Token> = tokenIter.next();
  if (!cur.done) {
    return cur.value;
  } else {
    fail("unexpected end-of-iteration");
  }
}

function matches(token: Token, fn: (typeName: tokenType, arg?: string | number) => boolean): boolean {
  return token.caseOf({
    Newline: () => fn("Newline"),
    Comment: () => fn("Comment"),
    SingleSpace: () => fn("SingleSpace"),
    MultiSpace: (num: number) => fn("MultiSpace", num),
    Text: (str: string) => fn("Text", str)
  });
}

function isA(thing: tokenType): (typeName: string) => boolean {
  return (typeName: string) => {
    const result = typeName === thing;

    return result;
  }
}

function isText(value: string): (typeName: tokenType, text: string) => boolean {
  return (typeName: tokenType, text: string) => typeName === "Text" && text === value;
}

function isSpaces(value: number): (typeName: tokenType, count: number) => boolean {
  return (typeName: tokenType, count: number) => typeName === "MultiSpace" && count === value;
}

test("tokenize", () => {
  const tokenIter = tokenize(new memoryStreams.ReadableStream("\n\n; 1  2    ABC\n ; 4 5  6 ;\n"));

  expect(matches(nextToken(tokenIter), isA("Newline"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("Newline"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("Comment"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("SingleSpace"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isText("1"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isSpaces(2))).toEqual(true);
  expect(matches(nextToken(tokenIter), isText("2"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isSpaces(4))).toEqual(true);
  expect(matches(nextToken(tokenIter), isText("ABC"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("Newline"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("SingleSpace"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("Comment"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("SingleSpace"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isText("4"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("SingleSpace"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isText("5"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isSpaces(2))).toEqual(true);
  expect(matches(nextToken(tokenIter), isText("6"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("SingleSpace"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("Comment"))).toEqual(true);
  expect(matches(nextToken(tokenIter), isA("Newline"))).toEqual(true);

  expect(tokenIter.next().done).toBe(true);
});

// test("blankOrComment", () => {
//   let line = ";;;; comments ;;;;";

//   isBlankLine(line).orElse(() => isCommentLine(line)).caseOf({
//     Nothing: () => fail("Should have worked"),
//     Just: (line) => {
//       line.caseOf({
//         Comment: (comment: string) => expect(comment).toEqual(";;; comments ;;;;"),
//         _: () => fail("Should have worked")
//       })
//     }
//   });
// });

test("isCommentLine", () => {
  const line = "  ;FIXME fix me";

  decodeLine(line).caseOf({
    Comment: (comment: string) => {
      expect(comment).toEqual("FIXME fix me");
    },
    _: () => fail("Should have worked")
  });
});

test("isCommentLine", () => {
  const line = ";  TODO: fix me ";

  decodeLine(line).caseOf({
    Comment: (comment: string) => {
      expect(comment).toEqual("  TODO: fix me ");
    },
    _: () => fail("Should have worked")
  });
});

test("isDescriptionLine", () => {
  const line = "2020-10-20  Food and Stuff  ; tag=value";

  decodeLine(line).caseOf({
    Description: (d: Description) => {
      expect(d.date).toEqual("2020-10-20");
      expect(d.desc).toEqual("Food and Stuff");
    },
    _: () => fail("Should have worked")
  });
});

test("isBlankLine", () => {
  const line = "   \n"

  decodeLine(line).caseOf({
    Blank: () => true,
    _: () => fail("Should have worked")
  });
});

test("isPostingLine", () => {
  const line = "    expenses:unclassified                 $-900.00";

  decodeLine(line).caseOf({
    Posting: (p: Posting) => {
      expect(p.category).toEqual("expenses:unclassified");
      expect(p.amountCents).toEqual(-90000);
    },
    _: () => fail("Should have worked")
  });
});

// test("parse", () => {
//   let journal = `; journal

// 2020-10-09 Big Faceless Corporation
//     expenses:food:spices  $12.99
//     assets:checking      $-12.99
// `;
//   let tokenIter = tokenize(new memoryStreams.ReadableStream(journal));
//   let txns = parse(tokenIter);

//   expect(txns.length).toEqual(1);
// });
