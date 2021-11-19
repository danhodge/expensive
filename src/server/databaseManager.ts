import { Just, Nothing } from 'seidr';
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

  async createDatabase(config: DatabaseConfig): Promise<Database> {
    return await
      this.storage
        .writePath(`${config.id}.expensive.json`, config.serialize())
        .then(() => this.storage.writePathIfNonExistent(config.journal, ""))
        .then(() => this.database(config.id))
        .catch((err) => {
          this.storage.deletePath(`${config.id}.expensive.json`);
          this.storage.deletePath(config.journal);
          throw err;
        });
  }

  async databases(): Promise<Array<Database>> {
    const pattern = /^(?<id>.+)\.expensive\.json$/;
    const scanner = (path: string) => {
      const match = path.match(pattern);
      if (match !== undefined && match !== null && match.groups !== undefined) {
        return Just(match.groups.id);
      } else {
        return Nothing();
      }
    }
    const pathsToIds = await this.storage.scan(scanner);
    const dbs = new Array<Database>();

    for (const entry of pathsToIds.entries()) {
      const dbResult =
        await this.storage
          .readPath(entry[0])  // TODO: is there a way to destructure this?
          .then(buffer => {
            return decodeString(dbConfigDecoder(entry[1]), buffer.toString())
              .map(config => new Database(config, this.storage));
          });

      // TODO: can this be tacked onto the map above?
      const db = dbResult.getOrElse(null);
      if (db !== undefined && db !== null) {
        if (await db.checkState(DatabaseState.Initialized)) {
          console.log(`done checking state`);
          dbs.push(db);
        }
      }
    }

    return Promise.resolve(dbs);
  }

  async database(id: string): Promise<Database> {
    return this.databases().then(dbs => {
      console.log(`HERE ARE THE DBs: ${dbs.length}`);
      const db = dbs.find(db => db.id() === id);
      if (db !== undefined) {
        return db;
      } else {
        return Promise.reject(`No database found with ${id}`);
      }
    });
  }
}
