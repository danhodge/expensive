import { Request } from 'supertest';

test("returns OK", async () => {
  const res = await new Request(app).get("/b").query({ title: "Hello" });
  expect(res.status).toEqual(200);
  expect(res.text).toContain("Hello");
});
