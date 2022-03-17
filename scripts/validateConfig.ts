import { readFileSync } from 'fs';
import { dbConfigDecoder } from '../src/server/database';
import { decodeString } from '../src/server/json';

if (process.argv.length < 3) {
  console.log("Usage: npm run config:validate <path-to-config-file");
} else {
  const data = readFileSync(process.argv[2]);
  const result = decodeString(dbConfigDecoder("SOME_ID"), data.toString());

  console.log(result);
}