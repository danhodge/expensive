import { SafeString } from 'handlebars';

export function toJSON(obj: unknown): SafeString {
  return new SafeString(JSON.stringify(obj));
}
