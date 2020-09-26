import { Token, tokenize, parse } from '../src/hledger'
import * as memoryStreams from 'memory-streams'

function nextToken(tokenIter: Generator<Token>): Token {
  let cur: IteratorResult<Token> = tokenIter.next();
  if (!cur.done) {
    return cur.value;
  } else {
    fail("unexpected end-of-iteration");
  }
}

function matchesExpectedText(token: Token, expText: string) {
  return (token.state == "text") && (token.value == expText);
}

test("tokenize", () => {
  let tokenIter = tokenize(new memoryStreams.ReadableStream("\n\n; 1  2    ABC\n ; 4 5  6 ;\n"));

  expect(nextToken(tokenIter).state).toBe("newline");
  expect(nextToken(tokenIter).state).toBe("newline");
  expect(nextToken(tokenIter).state).toBe("comment");
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(matchesExpectedText(nextToken(tokenIter), "1")).toBeTruthy;
  expect(nextToken(tokenIter).state).toBe("multi_space");
  expect(matchesExpectedText(nextToken(tokenIter), "2")).toBeTruthy;
  expect(nextToken(tokenIter).state).toBe("multi_space");
  expect(matchesExpectedText(nextToken(tokenIter), "ABC")).toBeTruthy;
  expect(nextToken(tokenIter).state).toBe("newline");
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("comment");
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(matchesExpectedText(nextToken(tokenIter), "4")).toBeTruthy;
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(matchesExpectedText(nextToken(tokenIter), "5")).toBeTruthy;
  expect(nextToken(tokenIter).state).toBe("multi_space");
  expect(matchesExpectedText(nextToken(tokenIter), "6")).toBeTruthy;
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("comment");
  expect(nextToken(tokenIter).state).toBe("newline");

  expect(tokenIter.next().done).toBe(true);
});
