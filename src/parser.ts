import { Streams, N, C, F, SingleParser, TupleParser } from '@masala/parser';
import { Posting } from './posting';

interface Record {
}

interface BlankLine extends Record {
}

interface CommentLine extends Record {
  text: string
}

interface TransactionRecord extends Record {
  id?: string
  date: Date
  description: string
  postings: Posting[]
}

function keepRecord(record: Record): boolean {
  if ((record as TransactionRecord).date) {
    return true;
  } else {
    return false;
  }
}

export function nonNewlineWhitespace(): TupleParser<string> {
  return C.charIn(" \t").optrep();
}

export function nonNewlineWhitespace1(): TupleParser<string> {
  return C.charIn(" \t").then(C.charIn(" \t").optrep());
}

export function blankLine(): SingleParser<BlankLine> {
  return nonNewlineWhitespace().then(C.charIn("\n")).map(() => { return {} });
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

function recordDesc(): SingleParser<[Date, string, string?]> {
  return date()
    .then(nonNewlineWhitespace1().drop())
    .then(description())
    .then(comment().opt())
    .then(C.char("\n").drop())
    .map(tuple => [tuple.at(0), tuple.at(1), tuple.at(2)]);
}

function extractId(tagsStr: string): string {
  let idTag = tagsStr.split(",").find(v => v.includes("id:"));
  if (idTag != null) {
    return idTag.split(":")[1].trim();
  } else {
    return null;
  }
}

export function record(): SingleParser<TransactionRecord> {
  return recordDesc()
    .then(posting().rep())
    .then(F.try(blankLine()).or(F.eos()).drop())
    .map(tuple => {
      return {
        date: tuple.at(0)[0] as Date,
        description: tuple.at(0)[1],
        id: tuple.at(0)[2].map(extractId).orElse(null),
        postings: drop(tuple.array(), 1)
      }
    });
}

function comment(): SingleParser<string> {
  return C.char(';').drop()
    .then(C.charNotIn("\n").optrep())
    .map(v => v.join("").trim());
}

export function commentAndNewline(): SingleParser<CommentLine> {
  return nonNewlineWhitespace().opt().then(comment()).then(C.char("\n").drop()).map(tuple => { return { text: tuple.at(1) } });
}

function drop<T>(arr: T[], count: number): T[] {
  let result = new Array<T>();
  let i = count;
  for (; i < arr.length; i++) {
    result.push(arr[i]);
  }

  return result;
}

function recordBlankLineOrCommentLine(): SingleParser<Record> {
  return F.try(record()).or(F.try(blankLine()).or(commentAndNewline()));
}

export function hledger(): TupleParser<Record> {
  return recordBlankLineOrCommentLine().optrep().then(F.eos());
}

export function parse(input: string): Record[] {
  let result = hledger().parse(Streams.ofString(input));
  if (result.isAccepted()) {
    return result.value.array().filter(keepRecord);
  }
}
