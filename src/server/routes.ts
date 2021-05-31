import { Request, Response, Router } from 'express';
import { transactionDecoder, serialize } from './transaction'
import { FileStorage } from './storage'
import { DatabaseManager } from './databaseManager'
import { decodeObject } from './json'

const router = Router();
const dbManager = new DatabaseManager(new FileStorage('./db'));

// TODO: for larger apps, define routes in separate files and register them here
// import FooRoutes from "./foo"
// router.use("foo", FooRoutes)

router.get("/", async (req: Request, res: Response, next) => {
  try {
    //let uniqCategories = await db.categoryNames();
    let dbs = [];
    for await (const db of dbManager.databases()) {
      dbs.push({ name: db.name(), url: db.url('http://localhost:3000') });
    }

    res.render("transactions", { databases: dbs });
  } catch (error) {
    next(error);
  }
});

// idea
// reading
// 1. lock file
// 2. read data into memory, store data & version
// 3. unlock file
// writing
// 1. lock file
// 2. read version
// 3. check to see if it matches expected version
// 4. increment version and write updated file
// 5. unlock file
router.get("/:dbId/transactions", async (req: Request, res: Response, next) => {
  // see: https://www.wisdomgeek.com/development/web-development/using-async-await-in-expressjs/
  try {
    const db = await dbManager.database(req.params.dbId);
    let txnResult = await db.transactions();
    txnResult.caseOf({
      Ok: txns => res.json(txns.map(serialize)),
      Err: err => res.status(400).json({ status: `Error: ${err}`, state: db.state })
    });

    // TODO: return more information
    //  if successfully loaded -> list of transactions
    //  if failed -> empty list + error message
    //  return a different formatted body + status code depending on situation
    //  use https://package.elm-lang.org/packages/elm/http/latest/Http#expectStringResponse to handle the differences

  } catch (error) {
    next(error);
  }
});

router.put("/:dbId/transactions/:id", (req: Request, res: Response) => {
  console.log(`Updating ${req.params.dbId} transaction: ${req.params.id} = ${JSON.stringify(req.body)}`);
  decodeObject(transactionDecoder, req.body).caseOf({
    Err: err => {
      res.status(400).json({ status: `Error: ${err}` });
    },
    Ok: async txn => {
      let result = await dbManager.database(req.params.dbId).then(db => db.updateTransaction(req.params.id, txn));
      result.caseOf({
        Err: updateErr => {
          res.status(400).json({ status: `Error: ${updateErr}` });
        },
        Ok: txn => {
          res.json({ status: "OK", transaction: serialize(txn) });
        }
      });
    }
  });
});

export default router;
