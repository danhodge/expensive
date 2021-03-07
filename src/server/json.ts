// OLD IMPLEMENTATONS

// function map2<A, B, T>(fn: (a: A, b: B) => T, decoderA: Decoder<A>, decoderB: Decoder<B>): Decoder<T> {
//   return ((obj: any) => {
//     return decoderA(obj).caseOf({
//       Err: errA => Err(errA),
//       Ok: (valA: A) => {
//         decoderB(obj).caseOf({
//           Err: errB => Err(errB),
//           Ok: (valB: B) => Ok(fn(valA, valB))
//         });
//       }
//     });
//   });
// }

// function map3<A, B, C, T>(fn: (a: A, b: B, c: C) => T, decoderA: Decoder<A>, decoderB: Decoder<B>, decoderC: Decoder<C>): Decoder<T> {
//   return ((obj: any) => fn(decoderA(obj), decoderB(obj), decoderC(obj)));
// }



import { Result, Ok, Err } from 'seidr';

export interface Decoder<T> {
  (obj: any): Result<string, T>
}

export function string(): Decoder<string> {
  return ((obj: any) => {
    // TODO: is this the right way to check for a string
    if (typeof (obj) === 'string') {
      return Ok(obj as string)
    } else {
      return Err(`${obj} is not a string`);
    }
  });
}

export function int(): Decoder<number> {
  return ((obj: any) => {
    // TODO: is this the right way to check if something is a number
    if (typeof (obj) === 'number') {
      return Ok(obj as number);
    } else {
      return Err(`${obj} is not a number`);
    }
  });
}

// TODO: function for combining decoders?
export function date(): Decoder<Date> {
  return ((obj: any) => {
    return string()(obj).caseOf({
      Err: err => Err(err),
      Ok: str => {
        let secs = Date.parse(str);
        if (isNaN(secs)) {
          return Err(`Invalid date: ${str}`);
        } else {
          return Ok(new Date(secs));
        }
      }
    });
  });
}

export function field<T>(name: string, decoder: Decoder<T>): Decoder<T> {
  return ((obj: any) => {
    return decoder(obj[name]).caseOf({
      Err: err => Err(`Error decoding field: '${name}' = ${err}`),
      Ok: val => Ok(val)
    });
  });
}

export function map<A, T>(fn: (a: A) => T, decoderA: Decoder<A>): Decoder<T> {
  return ((obj: any) => decoderA(obj).map(fn));
}

export function decode<T, V>(obj: any, decoder: Decoder<T>, next: (t: T) => Result<string, V>): Result<string, V> {
  return decoder(obj).caseOf({
    Err: err => Err(err),
    Ok: val => next(val)
  });
}

export function map2<A, B, T>(fn: (a: A, b: B) => T, decoderA: Decoder<A>, decoderB: Decoder<B>): Decoder<T> {
  return ((obj: any) => {
    return decode(
      obj,
      decoderA,
      (a: A) => { return decode(obj, decoderB, (b: B) => Ok(fn(a, b))) }
    );
  });
}

export function map3<A, B, C, T>(fn: (a: A, b: B, c: C) => T, decoderA: Decoder<A>, decoderB: Decoder<B>, decoderC: Decoder<C>): Decoder<T> {
  return ((obj: any) => {
    return decode(obj, decoderA, (a: A) => {
      return decode(obj, decoderB, (b: B) => {
        return decode(obj, decoderC, (c: C) => Ok(fn(a, b, c)));
      });
    });
  });
}

export function map4<A, B, C, D, T>(fn: (a: A, b: B, c: C, d: D) => T, decoderA: Decoder<A>, decoderB: Decoder<B>, decoderC: Decoder<C>, decoderD: Decoder<D>): Decoder<T> {
  return ((obj: any) => {
    return decode(obj, decoderA, (a: A) => {
      return decode(obj, decoderB, (b: B) => {
        return decode(obj, decoderC, (c: C) => {
          return decode(obj, decoderD, (d: D) => Ok(fn(a, b, c, d)));
        });
      });
    });
  });
}

export function array<T>(decoder: Decoder<T>): Decoder<T[]> {
  // TODO: what if obj is not an array?
  return ((obj: any) => {
    return obj.reduce((memo: Result<string, T[]>, cur: any) => {
      return memo.caseOf({
        Err: _ => memo,
        Ok: (arr: T[]) => {
          return decoder(cur).caseOf({
            Err: err => Err(err),
            Ok: (val: T) => {
              // TODO: this should not mutate arr
              arr.push(val);
              return Ok(arr);
            }
          });
        }
      });
    }, Ok(new Array<T>()));
  });
}

export function decodeString<T>(decoder: Decoder<T>, data: string): Result<string, T> {
  return decodeObject(decoder, JSON.parse(data));
}

export function decodeObject<T>(decoder: Decoder<T>, obj: any): Result<string, T> {
  return decoder(obj);
}
