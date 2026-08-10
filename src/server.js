const express = require("express");
const pool = require("./db");
const jobQueue = require("./queue");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

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

app.get("/jobs", async (req, res) => {
  const result = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC");
  res.json(result.rows);
});

const http = require("http");
const { Server } = require("socket.io");
const { QueueEvents } = require("bullmq");

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", () => console.log("dashboard connected"));

// Listen to what's happening in the queue, regardless of which process caused it
const queueEvents = new QueueEvents("jobs", { connection: { url: process.env.REDIS_URL } });
["waiting", "active", "completed", "failed"].forEach((event) => {
    queueEvents.on(event, () => io.emit("jobs:updated"));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`API listening on :${port}`));
