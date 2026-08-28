require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Keep unexpected promise failures from terminating the Node process.
// Individual routes should still return controlled error responses.
process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED PROMISE REJECTION:", error);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));


app.get("/", (req, res) => {
  res.json({ name: "TrioByte Portal API", status: "running" });
});

app.use("/auth", require("./routes/auth"));
app.use("/api", require("./routes/api"));

// IMPORTANT: this mount is required for GET /api/calendar/events
app.use("/api/calendar", require("./routes/calendar"));

app.use((err, req, res, next) => {
  console.error("REQUEST ERROR:", err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: "Internal server error" });
});


function closeOpenSessionsAtEndOfDay() {
  const now = new Date();
  if (now.getHours() !== 23 || now.getMinutes() !== 0) return;

  const pool = require("./db/pool");
  pool.query(
    `UPDATE login_logs
     SET logout_at = NOW()
     WHERE logout_at IS NULL`
  ).then(() => {
    console.log("End-of-day logout completed.");
  }).catch((error) => {
    console.error("END-OF-DAY LOGOUT ERROR:", error);
  });
}

// Check once per minute. Open sessions are closed at 23:00 server time.
setInterval(closeOpenSessionsAtEndOfDay, 60 * 1000);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`TrioByte backend running on http://localhost:${PORT}`);
});
