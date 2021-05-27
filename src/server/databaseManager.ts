import { readFile } from 'fs/promises';
import { Result, Ok, Err } from 'seidr';
import { Database, DatabaseConfig, DatabaseState } from './database';
import { Storage } from './storage';

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
      const db =
        await this.storage
          .readPath(paths[i])
          .then(buffer => JSON.parse(buffer.toString()))
          .then(json => new DatabaseConfig(json.name, json.journal, json.dataDir))
          .then(config => new Database(config, this.storage));

      if (await db.checkState(DatabaseState.Initialized)) {
        yield db;
      }
    }
  }
}
