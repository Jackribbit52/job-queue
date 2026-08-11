const IORedis = require("ioredis");
require("dotenv").config();

function createConnection() {
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

module.exports = createConnection;