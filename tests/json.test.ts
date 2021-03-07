import { map, string, int, date, field, map3, map4, array, decodeString, Decoder } from '../src/server/json'
import { Result, Err, Ok } from 'seidr';

class Other {
  constructor(readonly id: number, readonly category: string, readonly amountCents: number) { }
}

class Thing {
  constructor(readonly id: string, readonly date: Date, readonly description: string, readonly postings: Other[]) { }
}

let postingDecoder = map3(
  (id: number, catg: string, amt: number) => new Other(id, catg, amt),
  field("id", int()),
  field("category", string()),
  field("amountCents", int())
);

let transactionDecoder = map4(
  (id: string, date: Date, desc: string, postings: Other[]) => new Thing(id, date, desc, postings),
  field("id", string()),
  field("date", date()),
  field("description", string()),
  field("postings", array(postingDecoder))
);

test("array", () => {
  let dec = array(int());
  let rs = dec([1, 2, 3, 4, 5]);

  console.log(rs);
});

test("parse single transaction", () => {
  let str = '{"id":"2021121212","date":"Fri Mar 05 2021","description":"stuff","postings":[{"id":0,"category":"Expenses:Stuff","amountCents":1234}]}';
  decodeString(transactionDecoder, str).caseOf({
    Err: err => fail(`failed to parse transaction - error: ${err}`),
    Ok: txn => console.log(txn)
  });
});

test("parse multiple transactions", () => {
  let str = '[{"id":"2021121212","date":"Fri Mar 05 2021","description":"stuff","postings":[{"id":0,"category":"Expenses:Stuff","amountCents":1234}]},{"id":"2021131313","date":"Sate Mar 06 2021","description":"things","postings":[{"id":0,"category":"Expenses:Things","amountCents":2345}]}]';
  decodeString(array(transactionDecoder), str).caseOf({
    Err: err => fail(`failed to parse transaction - error: ${err}`),
    Ok: txn => console.log(txn)
  });
});
