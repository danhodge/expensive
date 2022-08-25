import { Request, Response, Router } from 'express';
import { DatabaseManager } from './databaseManager'

export function createRoutes(dbManager: DatabaseManager): Router {
  const router = Router();

  router.post("/:dbId/upload/:accountId", async (req: Request, resp: Response) => {
    try {
      const db = await dbManager.database(req.params.dbId);

      // store the CSV data
      (await db.storeCsv(req.params.accountId, req.body)).caseOf({
        Ok: async importId => {
          // fetch CSV config from db by accountId & parse CSV data into transactions
          const txns = await db.parseCsv(req.params.accountId, req.body, importId);

          // add transactions to db
          await db.createOrUpdateTransactions(txns);

          resp.status(200).json({ status: "OK" });
        },
        Err: err => {
          console.log(`ERROR: ${err}`);
          resp.status(500);
        }
      });
    } catch (err) {
      // TODO: handle this in middleware
      resp.status(500).render(`ERROR: ${err}`);
    }
  });

  return router;
}
