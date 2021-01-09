import { Request, Response, Router } from 'express';
import { readFileSync } from 'fs';
import { parse } from './parser'

const router = Router();

// TODO: for larger apps, define routes in separate files and register them here
// import FooRoutes from "./foo"
// router.use("foo", FooRoutes)

router.get("/transactions", (req: Request, res: Response) => {
  let data = readFileSync('test.journal').toString();
  res.json(parse(data));
});

export default router;
