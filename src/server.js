const http = require("http");
const { Server } = require("socket.io");
const { QueueEvents } = require("bullmq");
const app = require("./app");

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", () => console.log("dashboard connected"));

const queueEvents = new QueueEvents("jobs", { connection: { url: process.env.REDIS_URL } });
["waiting", "active", "completed", "failed"].forEach((event) => {
  queueEvents.on(event, () => io.emit("jobs:updated"));
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`API listening on :${port}`));