import { Streams, N, C, F, SingleParser, TupleParser } from '@masala/parser';
import { Maybe, Just, Nothing } from 'seidr';
import { Posting } from './posting';
import { Transaction } from './transaction';
import { TransactionDate } from './transactionDate';

// Other TS/JS parser library: https://github.com/GregRos/parjs

type BlankLine = unknown;

interface CommentLine {
  text: string
}

export interface TransactionRecord {
  id: string
  importId?: string
  date: TransactionDate
  description: string
  postings: Posting[]
}

type Record = BlankLine | CommentLine | TransactionRecord;

class IdGenerator {
  nextId: number;
  constructor() {
    this.nextId = 0;
  }

  id(): string {
    this.nextId++;
    return this.nextId.toString();
  }
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

export function transactionDate(): SingleParser<TransactionDate> {
  return N.integer()
    .then(C.char('-').drop())
    .then(N.integer())
    .then(C.char('-').drop())
    .then(N.integer())
    .map(tuple => {
      return new TransactionDate(tuple.at(0), tuple.at(1), tuple.at(2));
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
      const cents = tuple.at(1) * 100 + tuple.at(2);
      return tuple.at(0).map(() => cents * -1).orElse(cents);
    });
}

export function posting(): SingleParser<Posting> {
  return nonNewlineWhitespace1().drop()
    .then(postingDescription())
    .then(nonNewlineWhitespace().drop())
    .then(amount())
    .then(nonNewlineWhitespace().drop().then(comment().opt()))
    .then(C.char("\n").drop())
    .map(tuple => new Posting(tuple.at(2).map((str: string) => str).orElse(null), tuple.at(0), tuple.at(1)));
}

function recordDesc(): SingleParser<[TransactionDate, string, string?]> {
  return transactionDate()
    .then(nonNewlineWhitespace1().drop())
    .then(description())
    .then(comment().opt())
    .then(C.char("\n").drop())
    .map(tuple => [tuple.at(0), tuple.at(1), tuple.at(2)]);
}

function extractId(idGen: IdGenerator, tagsStr: string): string {
  const idTag = tagsStr.split(",").find(v => v.includes("id:"));
  if (idTag) {
    return idTag.split(":")[1].trim();
  } else {
    return idGen.id();
  }
}

export function record(idGen: IdGenerator = new IdGenerator()): SingleParser<TransactionRecord> {
  return recordDesc()
    .then(posting().rep())
    .then(F.try(blankLine()).or(F.eos()).drop())
    .map(tuple => {
      const postings = indexMap(drop(tuple.array(), 1), (posting, idx) => {
        return new Posting(idx, posting.category, posting.amountCents)
      });

      return new Transaction(tuple.at(0)[2].map((str: string) => extractId(idGen, str)).orElse(idGen.id()), tuple.at(0)[0] as TransactionDate, tuple.at(0)[1], postings);
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
  const result = new Array<T>();
  let i = count;
  for (; i < arr.length; i++) {
    result.push(arr[i]);
  }

  return result;
}

function indexMap<T, U>(arr: T[], fn: (val: T, index: number) => U): U[] {
  const results = new Array<U>();
  for (let i = 0; i < arr.length; i++) {
    results.push(fn(arr[i], i));
  }

  return results;
}

export function filterMap<T, U>(arr: T[], fn: (val: T, index: number) => Maybe<U>): U[] {
  const results = new Array<U>();
  for (let i = 0; i < arr.length; i++) {
    fn(arr[i], i).caseOf({
      Just: (val: U) => results.push(val),
      Nothing: () => { /* no-op */ }
    });
  }

  return results;
}

function recordBlankLineOrCommentLine(idGen: IdGenerator = new IdGenerator()): SingleParser<Record> {
  return F.try(record(idGen)).or(F.try(blankLine()).or(commentAndNewline()));
}

export function hledger(): TupleParser<Record> {
  const idGen = new IdGenerator();
  return recordBlankLineOrCommentLine(idGen).optrep().then(F.eos());
}

export function parse(input: string): TransactionRecord[] {
  const result = hledger().parse(Streams.ofString(input));
  if (result.isAccepted()) {
    return filterMap(result.value.array(), record => {
      if (keepRecord(record)) {
        return Just(record as TransactionRecord);
      } else {
        return Nothing();
      }
    });
  }

  return new Array<TransactionRecord>();
}

// TODO: should this return a Result instead?
// TODO: there is no way to successfully parse an empty file
export async function parse2(input: string): Promise<TransactionRecord[]> {
  return new Promise<TransactionRecord[]>((resolve, reject) => {
    const result = hledger().parse(Streams.ofString(input));
    if (result.isAccepted()) {
      resolve(filterMap(result.value.array(), record => {
        if (keepRecord(record)) {
          return Just(record as TransactionRecord);
        } else {
          return Nothing();
        }
      }));
    } else {
      reject("Parse Error");
    }
  });
}
