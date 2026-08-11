const createConnection = require("./redisConnection");
const { Worker } = require("bullmq");
const axios = require("axios");
const pool = require("./db");
require("dotenv").config();

function startWorker() {
  const connection = createConnection();

  const worker = new Worker("jobs", async (job) => {
    const { jobId } = job.data;
    await pool.query("UPDATE jobs SET status = 'running', updated_at = now() WHERE id = $1", [jobId]);
    try {
      if (job.name === "webhook") {
        const { url, body } = job.data;
        await axios.post(url, body ?? {});
      } else if (job.name === "delay") {
        const { seconds } = job.data;
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      }
      await pool.query("UPDATE jobs SET status = 'succeeded', updated_at = now() WHERE id = $1", [jobId]);
    } catch (err) {
      await pool.query(
        "UPDATE jobs SET attempts = attempts + 1, last_error = $2, status = 'failed', updated_at = now() WHERE id = $1",
        [jobId, err.message]
      );
      throw err;
    }
  }, { connection });

  worker.on("completed", (job) => console.log(`Job ${job.id} succeeded`));
  worker.on("failed", (job, err) => console.log(`Job ${job.id} failed: ${err.message}`));
  console.log("Worker running...");
  return worker;
}

module.exports = startWorker;