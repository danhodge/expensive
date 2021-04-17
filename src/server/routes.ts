import { Request, Response, Router } from 'express';
import { transactionDecoder, serialize } from './transaction'
import { FileStorage } from './storage'
import { Database } from './database'
import { decodeObject } from './json'

const router = Router();

const db = new Database('test.journal', new FileStorage());

// TODO: for larger apps, define routes in separate files and register them here
// import FooRoutes from "./foo"
// router.use("foo", FooRoutes)

router.get("/", async (req: Request, res: Response, next) => {
  try {
    let uniqCategories = await db.categoryNames();
    res.render("transactions", { categories: uniqCategories });
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
router.get("/transactions", async (req: Request, res: Response, next) => {
  // see: https://www.wisdomgeek.com/development/web-development/using-async-await-in-expressjs/
  try {
    let txns = await db.transactions();
    // TODO: return more information
    //  if successfully loaded -> list of transactions
    //  if failed -> empty list + error message
    //  return a different formatted body + status code depending on situation
    //  use https://package.elm-lang.org/packages/elm/http/latest/Http#expectStringResponse to handle the differences
    res.json(txns.map(serialize));
  } catch (error) {
    next(error);
  }
});

router.put("/transactions/:id", (req: Request, res: Response) => {
  console.log(`Updating transaction: ${req.params.id} = ${JSON.stringify(req.body)}`);
  decodeObject(transactionDecoder, req.body).caseOf({
    Err: err => {
      res.status(400).json({ status: `Error: ${err}` });
    },
    Ok: async txn => {
      let result = await db.updateTransaction(req.params.id, txn);
      result.caseOf({
        Err: updateErr => {
          res.status(400).json({ status: `Error: ${updateErr}` });
        },
        Ok: txn => {
          res.json({ status: "OK", transaction: txn });
        }
      });
    }
  });
});

export default router;
