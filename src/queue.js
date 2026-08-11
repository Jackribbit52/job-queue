const { Queue } = require("bullmq");
const createConnection = require("./redisConnection");

const jobQueue = new Queue("jobs", { connection: createConnection() });

module.exports = jobQueue;