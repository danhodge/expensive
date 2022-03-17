import { v4 as uuidv4 } from 'uuid';
import { DatabaseConfig } from "../src/server/database";
import { DatabaseManager } from "../src/server/databaseManager";
import { FileStorage } from '../src/server/storage';

async function createDb(name: string) {
  const id = uuidv4();
  const config = new DatabaseConfig(id, name, `${name}.journal`, `data/${id}`, []);
  const dbMgr = new DatabaseManager(new FileStorage("./db"));

  dbMgr.createDatabase(config)
    .then(db => console.log(`Created database: ${JSON.stringify(db)}`));
}

if (process.argv.length < 3) {
  console.log("Usage: npm run db:create <db-name>");
} else {
  createDb(process.argv[2]);
}
