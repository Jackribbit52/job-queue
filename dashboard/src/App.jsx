import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const socket = io(API_URL);

function statusColor(status) {
  switch (status) {
    case "succeeded": return "#4C9A6A";
    case "failed": return "#D9534F";
    case "running": return "#E8A33D";
    default: return "#8DA0BC"; // queued
  }
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [type, setType] = useState("webhook");
  const [url, setUrl] = useState("");
  const [seconds, setSeconds] = useState(5);

  const fetchJobs = async () => {
    const res = await axios.get(`${API_URL}/jobs`);
    setJobs(res.data);
  };

  useEffect(() => {
    fetchJobs(); // initial load
    socket.on("jobs:updated", fetchJobs); // re-fetch whenever the server says something changed
    return () => socket.off("jobs:updated", fetchJobs);
  }, []);

  const submitJob = async (e) => {
    e.preventDefault();
    const payload = type === "webhook" ? { url, body: {} } : { seconds: Number(seconds) };
    await axios.post(`${API_URL}/jobs`, { type, payload });
    fetchJobs();
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 800, margin: "40px auto", padding: "0 20px" }}>
      <h1>Job Queue Dashboard</h1>

      <form onSubmit={submitJob} style={{ marginBottom: 24, display: "flex", gap: 8 }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="webhook">webhook</option>
          <option value="delay">delay</option>
        </select>
        {type === "webhook" ? (
          <input
            placeholder="https://webhook.site/your-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1 }}
          />
        ) : (
          <input
            type="number"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
          />
        )}
        <button type="submit">Submit job</button>
      </form>

      <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th>ID</th><th>Type</th><th>Status</th><th>Attempts</th><th>Last error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{job.id}</td>
              <td>{job.type}</td>
              <td style={{ color: statusColor(job.status), fontWeight: 600 }}>{job.status}</td>
              <td>{job.attempts}</td>
              <td>{job.last_error || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}