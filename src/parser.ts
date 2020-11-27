import { Response, Streams, N, C, F } from '@masala/parser';

export function nonNewlineWhitespace() {
  return C.charIn(" \t").optrep();
}

export function nonNewlineWhitespace1() {
  return C.charIn(" \t").then(C.charIn(" \t").optrep());
}

export function blankLine() {
  return nonNewlineWhitespace().then(C.charIn("\n"));
}

export function date() {
  return N.integer()
    .then(C.char('-').drop())
    .then(N.integer())
    .then(C.char('-').drop())
    .then(N.integer());
}

export function postingDescription() {
  return (
    C.charNotIn("\n; ").rep().then(C.char(" "))
  ).rep()
    .then(C.char(" ").rep()).map(v => v.join("").trim());
}

export function description() {
  return C.charNotIn("\n;")
    .then(C.charNotIn("\n;").optrep());
}

export function amount() {
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

export function posting() {
  return nonNewlineWhitespace1().drop()
    .then(postingDescription())
    .then(nonNewlineWhitespace().drop())
    .then(amount())
    .then(C.char("\n").drop());
}

export function record() {
  return date()
    .then(nonNewlineWhitespace1().drop())
    .then(description())
    .then(comment().opt())
    .then(C.char("\n").drop())
    .then(posting())
    .then(posting().optrep())
    .then(F.try(blankLine()).or(F.eos()).drop());
}

function comment() {
  return C.char(';').drop()
    .then(C.charNotIn("\n").optrep());
}

export function commentAndNewline() {
  return comment().then(C.char("\n").drop());
}

export function hledger() {
  return (
    F.try(record())
      .or(F.try(blankLine()).or(commentAndNewline()))
  )
    .optrep()
    .then(F.eos());
}

export function parse(input: string): Response<any> {
  return hledger().parse(Streams.ofString(input));
}
