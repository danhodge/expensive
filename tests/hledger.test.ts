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

test("tokenize", () => {
  let tokenIter = tokenize(new memoryStreams.ReadableStream("\n\n; 1  2    ABC\n ; 4 5  6 ;\n"));

  expect(nextToken(tokenIter).state).toBe("newline");
  expect(nextToken(tokenIter).state).toBe("newline");
  expect(nextToken(tokenIter).state).toBe("comment");
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("text");  // 1
  expect(nextToken(tokenIter).state).toBe("multi_space");
  expect(nextToken(tokenIter).state).toBe("text");  // 2
  expect(nextToken(tokenIter).state).toBe("multi_space");
  expect(nextToken(tokenIter).state).toBe("text");  // ABC
  expect(nextToken(tokenIter).state).toBe("newline");
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("comment");
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("text");  // 4
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("text");  // 5
  expect(nextToken(tokenIter).state).toBe("multi_space");
  expect(nextToken(tokenIter).state).toBe("text");  // 6
  expect(nextToken(tokenIter).state).toBe("single_space");
  expect(nextToken(tokenIter).state).toBe("comment");
  expect(nextToken(tokenIter).state).toBe("newline");

  expect(tokenIter.next().done).toBe(true);
});
