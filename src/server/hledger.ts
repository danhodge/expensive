import { Readable } from "stream";
import { SumType } from "sums-up";
import { Maybe, Just, Nothing } from "seidr";

export type tokenType = "Newline" | "Comment" | "SingleSpace" | "MultiSpace" | "Text";

export class Token extends SumType<{
  Newline: [];
  Comment: [],
  SingleSpace: [],
  MultiSpace: [number],
  Text: [string]
}> { }

export function* eachLine(stream: Readable): Generator<string> {
  const streamIter = nextChar(stream);
  let curTxt = "";
  let cur = streamIter.next();

  while (!cur.done) {
    if (cur.value === "\n") {
      yield curTxt;
      curTxt = "";
    } else {
      curTxt += cur.value
    }
    cur = streamIter.next();
  }

  yield curTxt;
}

enum State {
  Init,
  Description,
  Postings,
  Invalid
}

// 4 kinds of lines in a journal
// 1. blank
// 2. comment
// 3. description
// 4. posting
// parse a file into lines
// parser will consume lines and keep track of state via a simple state machine: (desc -> posting+ -> blank)+
// and return array of transactions
// line types will be a sum type

export interface Description {
  date: string;
  desc: string;
}

export interface Posting {
  category: string;
  amountCents: number;
}

export class Line extends SumType<{
  Blank: [];
  Comment: [string],
  Description: [Description], // [date, string]
  Posting: [Posting],         // [string, number]
  Invalid: [string]
}> { }

// export function parse1(lineIter: Generator<Line>, handler: Handler): Array<Transaction> {
//   let curLine = lineIter.next();
//   let curDesc = null;
//   let postings = [];

//   while (!curLine.done) {
//     curLine = lineIter.next();
//     curLine.value.caseOf({
//       Description: (desc) => {
//         curDesc = desc
//         postings.index = 0
//       },
//       Posting: (post) => postings.push(post),
//       invalid: (err) => err,
//       _: (*) => noop
//     });
//   }
// }

export function* parse2(lineIter: Generator<string>): Generator<Line> {
  let state = State.Init;
  let curLine = lineIter.next();

  while (!curLine.done) {
    curLine = lineIter.next();

    state = decodeLine(curLine.value).caseOf({
      Description: () => {
        if (state === State.Init) {
          return State.Description;
        } else {
          return State.Invalid;
        }
      },
      Posting: () => {
        if (state === State.Description || state === State.Postings) {
          return State.Postings;
        } else {
          return State.Invalid;
        }
      },
      Blank: () => {
        if (state === State.Postings) {
          return State.Init;
        } else if (state === State.Description) {
          return State.Invalid;
        } else {
          return state;
        }
      },
      Comment: () => {
        return state;
      },
      _: () => State.Invalid
    });

    yield curLine.value;
  }
}

export function* eachTransaction(lineIter: Generator<string>): Generator<Array<string>> {
  let curLine = lineIter.next();
  let state = State.Init;
  const curTxn = new Array<string>();

  while (!curLine.done) {
    curLine = lineIter.next();
    if (isDescriptionLine(curLine.value) && state == State.Init) {
      state = State.Description;
      curTxn.push(curLine.value);
    } else if (isPostingLine(curLine.value) && (state == State.Description || state == State.Postings)) {
      state = State.Postings;
      curTxn.push(curLine.value);
    } else if (isBlankLine(curLine.value) && state == State.Postings) {
      yield curTxn;
      curTxn.length = 0;
      state = State.Init;
    } else if (isCommentLine(curLine.value) && state == State.Init) {
      // no-op
    } else {
      // how to handle errors?
      // raise?
      // error
    }
  }

  if (curTxn.length > 0) {
    yield curTxn
  }
}

export function decodeLine(line: string): Line {
  return isBlankLine(line)
    .orElse(() => isCommentLine(line))
    .orElse(() => isDescriptionLine(line))
    .orElse(() => isPostingLine(line))
    .getOrElse(new Line("Invalid", line));
}

function isBlankLine(line: string): Maybe<Line> {
  if (/^\s*$/.test(line)) {
    return Just(new Line("Blank"));
  } else {
    return Nothing();
  }
}

function isCommentLine(line: string): Maybe<Line> {
  const result = /^\s*;(?<comment>.*)/.exec(line);
  if (result && result.groups) {
    const { groups: { comment } } = result;
    return Just(new Line("Comment", comment));
  } else {
    return Nothing();
  }
}

function isDescriptionLine(line: string): Maybe<Line> {
  const result = line.match(/^(?<date>\d{4}-\d{2}-\d{2})\s{1,}(?<desc>\w.*)\s{2,}.*/)
  if (result && result.groups) {
    const { groups: { date, desc } } = result
    const d: Description = { date: date, desc: desc };
    return Just(new Line("Description", d));
  } else {
    return Nothing();
  }
}

function isPostingLine(line: string): Maybe<Line> {
  const result = line.match(/^\s{4,}(?<category>\w.*\w)\s{2,}\$(?<amount>-?\d+\.\d+)/)
  if (result && result.groups) {
    const { groups: { category, amount } } = result
    const p: Posting = { category: category, amountCents: parseFloat(amount) * 100 };
    return Just(new Line("Posting", p));
  } else {
    return Nothing();
  }
}

// class Description {
//   // constructor(date: string, desc: string, comment: string?) {
//   // }
// }

// class Posting {
//   // constructor(category: string, amount: string, comment: string?) {
//   // }
// }

// states:
// init, description, postings, error
export class ParserState extends SumType<{
  Init: [];
  Description: [Description],
  Postings: [Description, Array<Posting>],
  Complete: [Description, Array<Posting>],
  ParseError: [string]
}> { }

// interface Handler {
//   start(date: string, desc: string, comment?: string): void
//   posting(category: string, amount: string, comment?: string): void
//   finish(): void
//   done(): Array<Transaction>
// }

// export function parse(lineIter: Generator<String>, handler: Handler): Array<Transaction> {
//   let state = new ParserState("Init");
//   let cur: IteratorResult<String> = lineIter.next();
//   while (!cur.done) { //  && !isError(state)) {
//     let nState = nextState(cur.value, state, handler);
//     console.log(`state = ${state}, token = ${cur.value}, nextState = ${nState}`);
//     state = nState;
//     cur = lineIter.next();
//   }

//   return [];
// }

// export function nextState(line: string, state: ParserState, handler: Handler): ParserState {
//   return state.caseOf({
//     Init: () => {
//       let [rest, comment] = line.split("  ;", 2);
//       let [date, desc] = rest.split(" ", 2);
//       handler.start(date, desc, comment);
//       return new ParserState("Description", new Description(date, desc, comment));
//     },
//     Description: (desc) => {
//       return handlePosting(line, handler, (posting?: Posting) => {
//         if (posting) {
//           return new ParserState("Postings", desc, [posting]);
//         } else {
//           return new ParserState("ParseError", "Problem");
//         }
//       });
//     },
//     Postings: (desc, postings) => {
//       if (line.length === 0) {
//         handler.finish();
//         return new ParserState("Complete", desc, postings);
//       } else {
//         return handlePosting(line, handler, (posting?: Posting) => {
//           if (posting) {
//             return new ParserState("Postings", desc, [posting]);
//           } else {
//             return new ParserState("ParseError", "Problem");
//           }
//         });
//       }
//     }
//   });
// }

// export function handlePosting(line: string, handler: Handler, fn: (posting?: Posting) => ParserState): ParserState {
//   let [rest, postingComment] = line.split("  ;", 2);
//   const re = new RegExp("^\\s{4}(?<category>.+)\\s{2,}\\$(?<amount>[0-9\\.\\-]+)$");
//   let result = rest.match(re);
//   if (result) {
//     let { groups: { category, amount } } = rest.match(re);
//     handler.posting(category, amount, postingComment);
//     return fn(new Posting(category, amount, postingComment));
//   } else {
//     return fn();
//   }
// }


export function* tokenize(stream: Readable): Generator<Token> {
  const streamIter = nextChar(stream);
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
      const value = curTxt;
      curTxt = "";
      yield new Token("Text", value);
    }

    if (curCh === "\n") {
      yield new Token("Newline");
    } else if (curCh === ";") {
      yield new Token("Comment");
    } else if (inSpace && nextCh !== " ") {
      const token = new Token("MultiSpace", spacesCt + 1);
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
    for (const ch of buf.toString()) {
      yield ch;
    }
  }
}

  // text single_space (text | single_space)+ multi_space [comment *] newline
  // multi space (text | single_space)+ multi_space text newline
  // newline

  // export type parserStateType = "Init" | "InComment" | "Date" | "PreDescription" | "Description" | "PostDescription" | "PrePostings" | "ParseError";

  // export class ParserContext {
  //   constructor(date?: String) {
  //   }

  //   setDate(date: string) {
  //   }

  //   appendToDescription(token: string): ParserContext {
  //   }

  //   completeDescription(): ParserContext {
  //   }

  //   beginComment(): ParserContext {
  //   }

  //   appendToComment(token: string): ParserContext {
  //   }

  //   completeComment(): parserStateType {
  //   }
  // }

  // export class ParserState extends SumType<{
  //   Init: [ParserContext];
  //   InComment: [ParserContext],
  //   Date: [ParserContext],
  //   PreDescription: [ParserContext],
  //   Description: [ParserContext],
  //   PostDescription: [ParserContext],
  //   PrePostings: [ParserContext],
  //   ParseError: [ParserContext]
  // }> { };

  // export function parse1(tokenIter: Generator<Token>): Array<Transaction> {
  //   let state = new ParserState("Init", new ParserContext());
  //   let cur: IteratorResult<Token> = tokenIter.next();
  //   while (!cur.done && !isError(state)) {
  //     let nState = nextState(cur.value, state);
  //     console.log(`state = ${state}, token = ${cur.value}, nextState = ${nState}`);
  //     state = nState;
  //     cur = tokenIter.next();
  //   }

  //   return [];
  // }

  // function isError(state: ParserState) {
  //   return state.caseOf({
  //     ParseError: () => true,
  //     _: () => false
  //   });
  // }

  // function nextState(token: Token, state: ParserState): ParserState {
  //   return state.caseOf({
  //     Init: (context) => {
  //       return token.caseOf({
  //         Newline: () => new ParserState("Init", context),
  //         Text: (str) => new ParserState("Date", new ParserContext(str)),
  //         Comment: () => new ParserState("InComment", new ParserContext()),
  //         _: () => new ParserState("ParseError", "Expected Text")
  //       });
  //     },
  //     InComment: (context) => {
  //       return token.caseOf({
  //         Newline: () => {
  //           let nextStateName = context.completeComment();
  //           new ParserState(nextStateName, context);
  //         },
  //         Comment: () => new ParserState("InComment", context.appendToComment(";")),
  //         Text: (str) => new ParserState("InComment", context.appendToComment(str)),
  //         SingleSpace: () => new ParserState("InComment", context.appendToComment(" ")),
  //         MultiSpace: (_num) => new ParserState("InComment", context.appendToComment(" ")) // TODO: concat all of the spaces
  //       });
  //     },
  //     Date: (context) => {
  //       return token.caseOf({
  //         SingleSpace: () => new ParserState("PreDescription", context),
  //         _: () => new ParserState("ParseError", "Expected Single Space")
  //       });
  //     },
  //     PreDescription: (context) => {
  //       return token.caseOf({
  //         Text: (str) => new ParserState("Description", context.appendToDescription(str)),
  //         _: () => new ParserState("ParseError", "Expected Text")
  //       });
  //     },
  //     Description: (context) => {
  //       return token.caseOf({
  //         MultiSpace: (_numSpaces) => new ParserState("PostDescription", context.completeDescription()),
  //         Newline: () => new ParserState("PrePostings", context.completeDescription()),
  //         Comment: () => new ParserState("InComment", context.completeDescription().beginComment()),
  //         Text: (str) => new ParserState("Description", context.appendToDescription(str)),
  //         SingleSpace: () => new ParserState("Description", context.appendToDescription(" "))
  //       });
  //     },
  //     PrePostings: (dateStr, desc) => {

  //     }
  //     _: () => new ParserState("ParseError", "Not Implemented")
  //   });

  // -------

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
