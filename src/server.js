const express = require("express");
const pool = require("./db");
const jobQueue = require("./queue");

const app = express();
app.use(express.json());

app.post("/jobs", async (req, res) => {
  const { type, payload } = req.body;

  if (type !== "webhook" || !payload?.url) {
    return res.status(400).json({ error: "expected { type: 'webhook', payload: { url, body } }" });
  }

  // 1. Record the job in Postgres — this is our source of truth
  const result = await pool.query(
    "INSERT INTO jobs (type, payload) VALUES ($1, $2) RETURNING id",
    [type, payload]
  );
  const jobId = result.rows[0].id;

  // 2. Hand it to BullMQ to actually get processed
  await jobQueue.add("webhook", { jobId, ...payload }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  });

  res.status(201).json({ id: jobId, status: "queued" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));