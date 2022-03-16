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



import { Result, Ok, Err, Maybe, Just } from 'seidr';

export interface Decoder<T> {
  (obj: unknown): Result<string, T>
}

export function string(): Decoder<string> {
  return ((obj: unknown) => {
    // TODO: is this the right way to check for a string
    if (typeof (obj) === 'string') {
      return Ok(obj as string)
    } else {
      return Err(`${obj} is not a string`);
    }
  });
}

export function int(): Decoder<number> {
  return ((obj: unknown) => {
    // TODO: is this the right way to check if something is a number
    if (typeof (obj) === 'number') {
      return Ok(obj as number);
    } else {
      return Err(`${obj} is not a number`);
    }
  });
}

export function maybe<T>(decoder: Decoder<T>): Decoder<Maybe<T>> {
  return ((obj: unknown) => {
    return decoder(obj).caseOf({
      Ok: val => Ok(Just(val)),
      Err: () => Ok(new Maybe<T>("Nothing"))  // why does complier complain if this is Ok(Nothing)?
    });
  });
}

// TODO: function for combining decoders?
export function date(): Decoder<Date> {
  return ((obj: unknown) => {
    return string()(obj).caseOf({
      Err: err => Err(err),
      Ok: str => {
        const secs = Date.parse(str);
        if (isNaN(secs)) {
          return Err(`Invalid date: ${str}`);
        } else {
          return Ok(new Date(secs));
        }
      }
    });
  });
}


// A custom type guard function that narrows the given value into a value
// that exposes a string property named propertyName of unknown type
// TODO: does this return type make sense? if so, why?
function hasProperty(propertyName: string, value: unknown): value is { [key: string]: unknown } {
  return (value && value instanceof Object && propertyName in value);
}

export function field<T>(name: string, decoder: Decoder<T>): Decoder<T> {
  return ((obj: unknown) => {
    if (hasProperty(name, obj)) {
      return decoder(obj[name]).caseOf({
        Err: err => Err(`Error decoding field: '${name}' = ${err}`),
        Ok: val => Ok(val)
      });
    } else {
      return Err(`Object has no property: '${name}`);
    }
  });
}

export function map<A, T>(fn: (a: A) => T, decoderA: Decoder<A>): Decoder<T> {
  return ((obj: unknown) => decoderA(obj).map(fn));
}

export function decode<T, V>(obj: unknown, decoder: Decoder<T>, next: (t: T) => Result<string, V>): Result<string, V> {
  return decoder(obj).caseOf({
    Err: err => Err(err),
    Ok: val => next(val)
  });
}

export function map2<A, B, T>(fn: (a: A, b: B) => T, decoderA: Decoder<A>, decoderB: Decoder<B>): Decoder<T> {
  return ((obj: unknown) => {
    return decode(
      obj,
      decoderA,
      (a: A) => { return decode(obj, decoderB, (b: B) => Ok(fn(a, b))) }
    );
  });
}

export function map3<A, B, C, T>(fn: (a: A, b: B, c: C) => T, decoderA: Decoder<A>, decoderB: Decoder<B>, decoderC: Decoder<C>): Decoder<T> {
  return ((obj: unknown) => {
    return decode(obj, decoderA, (a: A) => {
      return decode(obj, decoderB, (b: B) => {
        return decode(obj, decoderC, (c: C) => Ok(fn(a, b, c)));
      });
    });
  });
}

export function map4<A, B, C, D, T>(fn: (a: A, b: B, c: C, d: D) => T, decoderA: Decoder<A>, decoderB: Decoder<B>, decoderC: Decoder<C>, decoderD: Decoder<D>): Decoder<T> {
  return ((obj: unknown) => {
    return decode(obj, decoderA, (a: A) => {
      return decode(obj, decoderB, (b: B) => {
        return decode(obj, decoderC, (c: C) => {
          return decode(obj, decoderD, (d: D) => Ok(fn(a, b, c, d)));
        });
      });
    });
  });
}

export function map5<A, B, C, D, E, T>(fn: (a: A, b: B, c: C, d: D, e: E) => T, decoderA: Decoder<A>, decoderB: Decoder<B>, decoderC: Decoder<C>, decoderD: Decoder<D>, decoderE: Decoder<E>): Decoder<T> {
  return ((obj: unknown) => {
    return decode(obj, decoderA, (a: A) => {
      return decode(obj, decoderB, (b: B) => {
        return decode(obj, decoderC, (c: C) => {
          return decode(obj, decoderD, (d: D) => {
            return decode(obj, decoderE, (e: E) => Ok(fn(a, b, c, d, e)));
          });
        });
      });
    });
  });
}

export function array<T>(decoder: Decoder<T>): Decoder<T[]> {
  return ((obj: unknown) => {
    if (Array.isArray(obj)) {
      return obj.reduce((memo: Result<string, T[]>, cur: unknown) => {
        return memo.caseOf({
          Err: () => memo,
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
    } else {
      return Err(`${obj} is not an Array`);
    }
  });
}

// export function stringKeyedMap<T>(decoder: Decoder<T>): Decoder<Map<string, T>> {
//   return ((obj: unknown) => {
//     if (isMap(obj)) {
//       const result = new Map<string, T>();
//       obj.forEach((val: unknown, key: unknown) => {
//         decoder(val).caseOf({
//           Err: err => "",
//           Ok: (v: T) => result.set("", v)
//         });
//       });

//       return Ok(result);
//     } else {
//       return Err(`${obj} is not a Map`);
//     }
//   });
// }

// function isMap<K, V>(obj: unknown): obj is Map<K, V> {
//   return obj !== undefined;
// }

export function decodeString<T>(decoder: Decoder<T>, data: string): Result<string, T> {
  return decodeObject(decoder, JSON.parse(data));
}

export function decodeObject<T>(decoder: Decoder<T>, obj: unknown): Result<string, T> {
  return decoder(obj);
}
