import { readFile } from 'fs/promises';
import { Result, Ok, Err, Just, Nothing } from 'seidr';
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

  // TODO: return type?
  // TODO: this shouldn't be a generator
  async *databases() {
    const pattern = new RegExp('^(?<id>.+)\.expensive\.json$');
    const scanner = (path: string) => {
      const match = path.match(pattern);
      if (match) {
        return Just(match.groups.id);
      } else {
        return Nothing();
      }
    }
    const pathsToIds = await this.storage.scan(scanner);

    for (const entry of pathsToIds.entries()) {
      const dbResult =
        await this.storage
          .readPath(entry[0])  // TODO: is there a way to destructure this?
          .then(buffer => {
            return decodeString(dbConfigDecoder(entry[1]), buffer.toString())
              .map(config => new Database(config, this.storage));
          });

      // TODO: this is gross - should the promise chain just raise if the config is invalid?
      let db = dbResult.getOrElse(null);
      if (db !== null && await db.checkState(DatabaseState.Initialized)) {
        yield db;
      }
    }
  }

  async database(id: string): Promise<Database> {
    for await (const db of this.databases()) {
      if (db.id() === id) {
        return db;
      }
    }
  }
}
