import { Request, Response, Router } from 'express';
import { DatabaseManager } from './databaseManager'

export function createRoutes(dbManager: DatabaseManager): Router {
  const router = Router();

  router.post("/:dbId/upload/:accountId", async (req: Request, resp: Response) => {
    const db = await dbManager.database(req.params.dbId);
    console.log(`HERE IS THE DB: ${db}, ${req.body}`);

    // fetch CSV config from db by accountId

    // parse CSV data into transactions
    // add transactions to db

    resp.status(200).json({ status: "OK" });
  });

  return router;
}
