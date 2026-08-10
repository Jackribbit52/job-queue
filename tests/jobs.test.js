jest.mock("../src/db", () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
}));
jest.mock("../src/queue", () => ({
  add: jest.fn().mockResolvedValue(true),
}));

const request = require("supertest");
const app = require("../src/app");

describe("POST /jobs", () => {
  it("rejects an unknown job type", async () => {
    const res = await request(app).post("/jobs").send({ type: "carrier-pigeon" });
    expect(res.status).toBe(400);
  });

  it("rejects a webhook job with no url", async () => {
    const res = await request(app).post("/jobs").send({ type: "webhook", payload: {} });
    expect(res.status).toBe(400);
  });

  it("rejects a delay job with no seconds", async () => {
    const res = await request(app).post("/jobs").send({ type: "delay", payload: {} });
    expect(res.status).toBe(400);
  });

  it("accepts a valid webhook job", async () => {
    const res = await request(app)
      .post("/jobs")
      .send({ type: "webhook", payload: { url: "https://example.com" } });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });
});