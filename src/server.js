const express = require("express");
const pool = require("./db");
const jobQueue = require("./queue");

const app = express();
app.use(express.json());

app.post("/jobs", async (req, res) => {
  const { type, payload } = req.body;

  const validTypes = ["webhook", "delay"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
  }
  if (type === "webhook" && !payload?.url) {
    return res.status(400).json({ error: "webhook jobs require payload.url" });
  }
  if (type === "delay" && typeof payload?.seconds !== "number") {
    return res.status(400).json({ error: "delay jobs require payload.seconds (a number)" });
  }

  const result = await pool.query(
    "INSERT INTO jobs (type, payload) VALUES ($1, $2) RETURNING id",
    [type, payload]
  );
  const jobId = result.rows[0].id;

  await jobQueue.add(type, { jobId, ...payload }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  });

  res.status(201).json({ id: jobId, status: "queued" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));