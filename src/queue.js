const { Queue } = require("bullmq");
require("dotenv").config();

const connection = { url: process.env.REDIS_URL };

const jobQueue = new Queue("jobs", { connection });

module.exports = jobQueue;