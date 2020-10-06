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

// text single_space (text | single_space)+ multi_space [comment *] newline
// multi space (text | single_space)+ multi_space text newline
// newline

export type parserStateType = "Init" | "InComment" | "Date" | "PreDescription" | "Description" | "PostDescription" | "PrePostings" | "ParseError";

export class ParserContext {
  constructor(date?: String) {
  }

  setDate(date: string) {
  }

  appendToDescription(token: string): ParserContext {
  }

  completeDescription(): ParserContext {
  }

  beginComment(): ParserContext {
  }

  appendToComment(token: string): ParserContext {
  }

  completeComment(): parserStateType {
  }
}

export class ParserState extends SumType<{
  Init: [ParserContext];
  InComment: [ParserContext],
  Date: [ParserContext],
  PreDescription: [ParserContext],
  Description: [ParserContext],
  PostDescription: [ParserContext],
  PrePostings: [ParserContext],
  ParseError: [ParserContext]
}> { };

export function parse(tokenIter: Generator<Token>): Array<Transaction> {
  let state = new ParserState("Init", new ParserContext());
  let cur: IteratorResult<Token> = tokenIter.next();
  while (!cur.done && !isError(state)) {
    let nState = nextState(cur.value, state);
    console.log(`state = ${state}, token = ${cur.value}, nextState = ${nState}`);
    state = nState;
    cur = tokenIter.next();
  }

  return [];
}

function isError(state: ParserState) {
  return state.caseOf({
    ParseError: () => true,
    _: () => false
  });
}

function nextState(token: Token, state: ParserState): ParserState {
  return state.caseOf({
    Init: (context) => {
      return token.caseOf({
        Newline: () => new ParserState("Init", context),
        Text: (str) => new ParserState("Date", new ParserContext(str)),
        Comment: () => new ParserState("InComment", new ParserContext()),
        _: () => new ParserState("ParseError", "Expected Text")
      });
    },
    InComment: (context) => {
      return token.caseOf({
        Newline: () => {
          let nextStateName = context.completeComment();
          new ParserState(nextStateName, context);
        },
        Comment: () => new ParserState("InComment", context.appendToComment(";")),
        Text: (str) => new ParserState("InComment", context.appendToComment(str)),
        SingleSpace: () => new ParserState("InComment", context.appendToComment(" ")),
        MultiSpace: (_num) => new ParserState("InComment", context.appendToComment(" ")) // TODO: concat all of the spaces
      });
    },
    Date: (context) => {
      return token.caseOf({
        SingleSpace: () => new ParserState("PreDescription", context),
        _: () => new ParserState("ParseError", "Expected Single Space")
      });
    },
    PreDescription: (context) => {
      return token.caseOf({
        Text: (str) => new ParserState("Description", context.appendToDescription(str)),
        _: () => new ParserState("ParseError", "Expected Text")
      });
    },
    Description: (context) => {
      return token.caseOf({
        MultiSpace: (_numSpaces) => new ParserState("PostDescription", context.completeDescription()),
        Newline: () => new ParserState("PrePostings", context.completeDescription()),
        Comment: () => new ParserState("InComment", context.completeDescription().beginComment()),
        Text: (str) => new ParserState("Description", context.appendToDescription(str)),
        SingleSpace: () => new ParserState("Description", context.appendToDescription(" "))
      });
    },
    PrePostings: (dateStr, desc) => {

    }
    _: () => new ParserState("ParseError", "Not Implemented")
  });

  // switch (state.state) {
  //   case "init":
  //     if (token.state == "text") {
  //       return { state: "date", date: token.value }
  //     }

  //   case "date":
  //     if (token.state == "single_space") {
  //       // TODO: why is this casting necessary?
  //       return { state: "pre_description", date: (state as Date).date };
  //     }

  //   case "pre_description":
  //     if (token.state == "text") {
  //       return { state: "description", date: (state as PreDescription).date, text: [] }
  //     }

  //   case "description":
  //     if (token.state == "text") {
  //       return { state: "description", date: (state as Description).date, text: (state as Description).text + [token.value] }
  //     } else if (token.state == "single_space") {
  //       return { state: "description", date: (state as Description).date, text: (state as Description).text + [" "] }
  //     }

  //   default:
  //     return { state: "parse_error" };
  // }
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
