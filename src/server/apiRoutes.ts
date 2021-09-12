import { Request, Response, Router } from 'express';

export const router = Router();

router.post("/upload_csv", (req: Request, resp: Response) => {
  resp.status(200).json({ status: "OK" });
});
