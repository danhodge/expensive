import { SafeString } from 'handlebars';

export function toJSON(obj: any): SafeString {
  return new SafeString(JSON.stringify(obj));
}
