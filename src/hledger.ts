import { Readable } from "stream";
import { SumType } from "sums-up";
import { Transaction } from "./transaction";

export type tokenType = "Newline" | "Comment" | "SingleSpace" | "MultiSpace" | "Text";

export class Token extends SumType<{
  Newline: [];
  Comment: [],
  SingleSpace: [],
  MultiSpace: [number],
  Text: [string]
}> { };

export function* tokenize(stream: Readable): Generator<Token> {
  let streamIter = nextChar(stream);
  let curCh = null;
  let nextCh = null;
  let inSpace = false;
  let spacesCt = 0;
  let curTxt = "";

  let cur = streamIter.next();
  while (!cur.done) {
    if (nextCh !== null) {
      curCh = nextCh;
    }
    nextCh = cur.value;
    // console.log(`curCh = [${curCh}], nextCh = [${nextCh}], spacesCt = ${spacesCt}`)

    if ((curCh === "\n" || curCh === " " || curCh === ";") && curTxt.length > 0) {
      // console.log(`yielding text = ${curTxt}`);
      let value = curTxt;
      curTxt = "";
      yield new Token("Text", value);
    }

    if (curCh === "\n") {
      yield new Token("Newline");
    } else if (curCh === ";") {
      yield new Token("Comment");
    } else if (inSpace && nextCh !== " ") {
      let token = new Token("MultiSpace", spacesCt + 1);
      inSpace = false;
      spacesCt = 0;
      yield token;
    } else if (curCh === " " && nextCh != " ") {
      yield new Token("SingleSpace");
    } else if (curCh === " " && nextCh == " ") {
      inSpace = true;
      spacesCt += 1;
    } else if (curCh !== null) {
      curTxt += curCh;
    }

    cur = streamIter.next();
  }

  if (inSpace) {
    return new Token("MultiSpace", spacesCt);
  }

  if (nextCh === "\n") {
    yield new Token("Newline");
  } else if (nextCh === ";") {
    yield new Token("Comment");
  } else if (!inSpace && nextCh === " ") {
    yield new Token("SingleSpace");
  } else {
    yield new Token("Text", curTxt);
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

type Init = {
  state: "init";
}

type Date = {
  state: "date";
  date: string;
}

type PreDescription = {
  state: "pre_description";
  date: string;
}

type Description = {
  state: "description";
  date: string;
  text: Array<String>;
}

type ParseError = {
  state: "parse_error";
}


// text single_space (text | single_space)+ multi_space [comment *] newline
// multi space (text | single_space)+ multi_space text newline
// newline


type ParserState =
  | Init
  | Date
  | PreDescription
  | Description
  | ParseError

// export function parse(tokenIter: Generator<Token>): Array<Transaction> {
//   let state: ParserState = { state: "init" };
//   let cur: IteratorResult<Token> = tokenIter.next();
//   if (!cur.done) {
//     state = nextState(cur.value, state);
//   }

//   return [];
// }

// function nextState(token: Token, state: ParserState): ParserState {
//   switch (state.state) {
//     case "init":
//       if (token.state == "text") {
//         return { state: "date", date: token.value }
//       }

//     case "date":
//       if (token.state == "single_space") {
//         // TODO: why is this casting necessary?
//         return { state: "pre_description", date: (state as Date).date };
//       }

//     case "pre_description":
//       if (token.state == "text") {
//         return { state: "description", date: (state as PreDescription).date, text: [] }
//       }

//     case "description":
//       if (token.state == "text") {
//         return { state: "description", date: (state as Description).date, text: (state as Description).text + [token.value] }
//       } else if (token.state == "single_space") {
//         return { state: "description", date: (state as Description).date, text: (state as Description).text + [" "] }
//       }

//     default:
//       return { state: "parse_error" };
//   }
// }



/*
 * Readable -> (() -> Token)
 *
 * ( Context, State ) -> (() -> Token) -> ( Context, State )
 *
 * Readable
 *
 *
 */
