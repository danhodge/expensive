import { Response, Streams, N, C, F, SingleParser, TupleParser, Tuple } from '@masala/parser';
import { Posting } from './posting';
import { Transaction } from './transaction';

export function nonNewlineWhitespace(): TupleParser<string> {
  return C.charIn(" \t").optrep();
}

export function nonNewlineWhitespace1(): TupleParser<string> {
  return C.charIn(" \t").then(C.charIn(" \t").optrep());
}

export function blankLine(): TupleParser<string> {
  return nonNewlineWhitespace().then(C.charIn("\n"));
}

export function date(): SingleParser<Date> {
  return N.integer()
    .then(C.char('-').drop())
    .then(N.integer())
    .then(C.char('-').drop())
    .then(N.integer())
    .map(tuple => {
      let date = new Date(tuple.at(0), tuple.at(1) - 1, tuple.at(2));
      date.setUTCHours(0);
      date.setUTCMinutes(0);
      date.setUTCSeconds(0);
      date.setUTCMilliseconds(0);

      return date;
    });
}

export function postingDescription(): SingleParser<string> {
  return (
    C.charNotIn("\n; ").rep().then(C.char(" "))
  ).rep()
    .then(C.char(" ").rep()).map(v => v.join("").trim());
}

export function description(): SingleParser<string> {
  return C.charNotIn("\n;")
    .then(C.charNotIn("\n;").optrep())
    .map(v => v.join("").trim());
}

export function amount(): SingleParser<number> {
  return C.char('$').drop()
    .then(C.char('-').opt())
    .then(N.integer())
    .then(C.char('.').drop())
    .then(N.integer())
    .map(tuple => {
      let cents = tuple.at(1) * 100 + tuple.at(2);
      return tuple.at(0).map(() => cents * -1).orElse(cents);
    });
}

export function posting(): SingleParser<Posting> {
  return nonNewlineWhitespace1().drop()
    .then(postingDescription())
    .then(nonNewlineWhitespace().drop())
    .then(amount())
    .then(C.char("\n").drop())
    .map(tuple => new Posting(-1, tuple.at(0), tuple.at(1)));  // TODO: stop hard-coding posting id
}

function recordDesc(): SingleParser<[Date, string]> {
  return date()
    .then(nonNewlineWhitespace1().drop())
    .then(description())
    .then(comment().opt().drop())  // TODO: need to stop dropping this
    .then(C.char("\n").drop())
    .map(tuple => [tuple.at(0), tuple.at(1)]);
}

export function record(): TupleParser<String> {
  // TODO: group each record into its own array
  return recordDesc()
    .then(posting().rep())
    .then(F.try(blankLine()).or(F.eos()).drop());
}

function comment(): TupleParser<string> {
  return C.char(';').drop()
    .then(C.charNotIn("\n").optrep());
}

export function commentAndNewline(): TupleParser<string> {
  return comment().then(C.char("\n").drop());
}

function recordBlankLineOrCommentLine(): SingleParser<Transaction> {
  return F.try(record())
    .or(F.try(blankLine().drop()).or(commentAndNewline().drop()))
    .map(
      (tuple: Tuple<string> | symbol) => {
        if (typeof tuple === "symbol") {
          return null;
        } else {
          let postings = new Array<Posting>();
          let i = 1;
          for (; i < tuple.size(); i++) {
            // the tuple tuple is being specified as Posting but I think it's being thrown away
            let posting: unknown = tuple.at(i);
            postings.push(posting as Posting);
          }

          // the tuple type is specified as [Date, string] but I think it's being thrown away
          let date: unknown = tuple.at(0)[0];
          return new Transaction(-1, (date as Date), tuple.at(0)[1], postings);
        }
      }
    );
}

export function hledger(): TupleParser<Transaction> {
  return recordBlankLineOrCommentLine().optrep().then(F.eos());
}

export function parse(input: string): Response<Tuple<Transaction>> {
  return hledger().parse(Streams.ofString(input));
}
