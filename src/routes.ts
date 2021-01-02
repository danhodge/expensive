import { Request, Response, Router } from 'express';

const router = Router();

// TODO: for larger apps, define routes in separate files and register them here
// import FooRoutes from "./foo"
// router.use("foo", FooRoutes)

router.get("/transactions", (req: Request, res: Response) => {
  res.json([]);
});

export default router;
