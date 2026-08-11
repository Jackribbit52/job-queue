const express = require("express");
const cors = require("cors");
const pool = require("./db");
const jobQueue = require("./queue");
const createConnection = require("./redisConnection");

const app = express();
app.use(cors());
app.use(express.json());

// TEMP diagnostic route — remove after debugging Render/Upstash connectivity.
app.get("/health/redis", async (req, res) => {
  const raw = process.env.REDIS_URL || "";
  const scheme = raw.split("://")[0] || null;
  const hostPort = raw.split("@")[1] || null; // no credentials, just host:port/db

  const conn = createConnection();
  const events = [];
  ["connect", "ready", "error", "close", "reconnecting", "end"].forEach((e) =>
    conn.on(e, (arg) => events.push(e + (arg?.message ? `: ${arg.message}` : "")))
  );

  try {
    const pong = await Promise.race([
      conn.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ping timed out after 5s")), 5000)),
    ]);
    res.json({ ok: true, pong, status: conn.status, scheme, hostPort, events });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, code: err.code, status: conn.status, scheme, hostPort, events });
  } finally {
    conn.disconnect();
  }
});

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

  try {
    await jobQueue.add(type, { jobId, ...payload }, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
    });
    console.log(`Job ${jobId} added to queue successfully`);
  } catch (err) {
    console.error(`Failed to add job ${jobId} to queue:`, err.message);
  }

  res.status(201).json({ id: jobId, status: "queued" });
});

app.get("/jobs", async (req, res) => {
  const result = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
  res.json(result.rows);
});

module.exports = app;