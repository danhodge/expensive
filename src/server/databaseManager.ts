import { readFile } from 'fs/promises';
import { Result, Ok, Err } from 'seidr';
import { Database, DatabaseConfig, DatabaseState, dbConfigDecoder } from './database';
import { Storage } from './storage';
import { decodeString } from './json';

export class DatabaseManager {
  constructor(readonly storage: Storage) {
  }

  // async databases(): Promise<Result<string, Database[]>> {
  //   let pattern = new RegExp('^\/(?<id>.+)\.expensive\.json$');
  //   // TODO: what is returned when this fails
  //   let dbPaths = await this.storage.scan((path: string) => pattern.test(path));

  //   return Promise.all(
  //     dbPaths.map(async (path: string) => {
  //       return readFile(path)
  //         .then((buffer) => JSON.parse(buffer.toString()))
  //         .then((config) => new Database(config, this.storage))
  //       // TODO: is a .catch needed here
  //     })
  //   ).then((dbs) => Ok(dbs))
  //     .catch((err) => Err(err));
  // }

  async *databases() {
    const pattern = new RegExp('^\/(?<id>.+)\.expensive\.json$');
    const paths = await this.storage.scan(path => pattern.test(path));

    // TODO: is there a way to do a for/in loop without indexing?
    for (const i in paths) {
      const dbResult =
        await this.storage
          .readPath(paths[i])
          .then(buffer => {
            return decodeString(dbConfigDecoder, buffer.toString())
              .map(config => new Database(config, this.storage));
          });

      // TODO: this is gross - should the promise chain just raise if the config is invalid?
      let db = dbResult.getOrElse(null);
      if (db !== null && await db.checkState(DatabaseState.Initialized)) {
        yield db;
      }
    }
  }
}
