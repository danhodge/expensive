import { Readable } from "stream";
import { Transaction } from "./transaction";

type Newline = {
  state: "newline";
}
type Comment = {
  state: "comment";
}
type SingleSpace = {
  state: "single_space";
}
type MultiSpace = {
  state: "multi_space";
}
type Text = {
  state: "text";
  value: string;
}

export type Token =
  | Newline
  | Comment
  | SingleSpace
  | MultiSpace
  | Text

export function* tokenize(stream: Readable): Generator<Token> {
  let streamIter = nextChar(stream);
  let curCh = null;
  let nextCh = null;
  let inSpace = false;
  let curTxt = "";

  let cur = streamIter.next();
  while (!cur.done) {
    if (nextCh !== null) {
      curCh = nextCh;
    }
    nextCh = cur.value;
    // console.log(`curCh = [${curCh}], nextCh = [${nextCh}]`)

    if ((curCh === "\n" || curCh === " " || curCh === ";") && curTxt.length > 0) {
      // console.log(`yielding text = ${curTxt}`);
      let value = curTxt;
      curTxt = "";
      yield { state: "text", value: value };
    }

    if (curCh === "\n") {
      yield { state: "newline" };
    } else if (curCh === ";") {
      yield { state: "comment" };
    } else if (inSpace && nextCh !== " ") {
      inSpace = false;
      yield { state: "multi_space" }
    } else if (curCh === " " && nextCh != " ") {
      yield { state: "single_space" }
    } else if (curCh === " " && nextCh == " ") {
      inSpace = true;
    } else if (curCh !== null) {
      curTxt += curCh;
    }

    cur = streamIter.next();
  }

  if (inSpace) {
    yield { state: "multi_space" };
  }

  if (nextCh === "\n") {
    yield { state: "newline" };
  } else if (nextCh === ";") {
    yield { state: "comment" };
  } else if (!inSpace && nextCh === " ") {
    yield { state: "single_space" };
  } else {
    yield { state: "text", value: curTxt };
  }
}

function* nextChar(stream: Readable): Generator<string> {
  let buf: Buffer;
  while ((buf = stream.read()) !== null) {
    for (let ch of buf.toString()) {
      yield ch;
    }
  }
}

export function parse(stream: Readable): Array<Transaction> {
  return [];
}

/*
 * Readable -> (() -> Token)
 *
 * ( Context, State ) -> (() -> Token) -> ( Context, State )
 *
 * Readable
 *
 *
 */
