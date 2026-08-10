const { Worker } = require("bullmq");
const axios = require("axios");
const pool = require("./db");
require("dotenv").config();

const connection = { url: process.env.REDIS_URL };

const worker = new Worker("jobs", async (job) => {
  const { jobId, url, body } = job.data;

  await pool.query("UPDATE jobs SET status = 'running', updated_at = now() WHERE id = $1", [jobId]);

  try {
    await axios.post(url, body ?? {});
    await pool.query(
      "UPDATE jobs SET status = 'succeeded', updated_at = now() WHERE id = $1",
      [jobId]
    );
  } catch (err) {
    await pool.query(
      "UPDATE jobs SET attempts = attempts + 1, last_error = $2, status = 'failed', updated_at = now() WHERE id = $1",
      [jobId, err.message]
    );
    throw err; // re-throwing tells BullMQ to retry per the attempts/backoff config
  }
}, { connection });

worker.on("completed", (job) => console.log(`Job ${job.id} succeeded`));
worker.on("failed", (job, err) => console.log(`Job ${job.id} failed: ${err.message}`));

console.log("Worker running...");