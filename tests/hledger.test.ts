import { Token, tokenType, tokenize } from '../src/hledger'
import * as memoryStreams from 'memory-streams'

function nextToken(tokenIter: Generator<Token>): Token {
  let cur: IteratorResult<Token> = tokenIter.next();
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
    let result = typeName === thing;

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
  let tokenIter = tokenize(new memoryStreams.ReadableStream("\n\n; 1  2    ABC\n ; 4 5  6 ;\n"));

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

// test("parse", () => {

// });
