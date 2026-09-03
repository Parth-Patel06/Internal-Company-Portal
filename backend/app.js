require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const pool = require("./db/pool");

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

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

app.locals.io = io;

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const data = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT id, employee_id, full_name, email, role, blocked, employment_status
       FROM users WHERE id = $1`,
      [data.id]
    );

    if (!rows[0]) return next(new Error("Account unavailable"));
    if (rows[0].blocked) return next(new Error("Account is blocked"));
    if (String(rows[0].employment_status || "Active").toUpperCase() !== "ACTIVE") {
      return next(new Error("Account is not active"));
    }

    socket.user = rows[0];
    next();
  } catch (error) {
    next(new Error("Invalid or expired session"));
  }
});

io.on("connection", (socket) => {
  socket.join(`chat:user:${socket.user.id}`);

  socket.on("chat:join", async (conversationId) => {
    const id = Number(conversationId);
    if (!Number.isInteger(id)) return;

    const rows = await pool.query(
      `SELECT id FROM chat_conversations
       WHERE id = $1
         AND (user_one_id = $2 OR user_two_id = $2)`,
      [id, socket.user.id]
    ).catch(() => ({ rows: [] }));

    const management = ["CEO", "ADMIN", "HR"].includes(String(socket.user.role || "").toUpperCase());
    if (rows.rows.length || management) socket.join(`chat:conversation:${id}`);
  });

  socket.on("chat:leave", (conversationId) => {
    const id = Number(conversationId);
    if (Number.isInteger(id)) socket.leave(`chat:conversation:${id}`);
  });
});

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



function completeDueOffboardings() {
  const pool = require("./db/pool");
  return pool.query(`
    UPDATE users u
    SET employment_status = 'Exited',
        offboarding_completed_at = COALESCE(u.offboarding_completed_at, NOW())
    WHERE UPPER(COALESCE(u.employment_status, 'ACTIVE')) = 'OFFBOARDING'
      AND u.id IN (
        SELECT o.user_id FROM offboarding_records o
        WHERE o.status = 'OFFBOARDING'
          AND o.last_working_day <= CURRENT_DATE
      )
  `).then(() => pool.query(`
    UPDATE offboarding_records
    SET status = 'COMPLETED', completed_at = COALESCE(completed_at, NOW())
    WHERE status = 'OFFBOARDING'
      AND last_working_day <= CURRENT_DATE
  `)).catch((error) => console.error("OFFBOARDING COMPLETION ERROR:", error));
}

setInterval(completeDueOffboardings, 60 * 1000);
completeDueOffboardings();

// Monthly payroll generation:
// On the 1st of each month, create payroll for the PREVIOUS calendar month.
// Days 2-7 are a catch-up window if the backend was offline on the 1st.
async function generatePreviousMonthPayroll() {
  const pool = require("./db/pool");
  const now = new Date();
  if (now.getDate() > 7) return;

  const previousFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousYear = previousFirst.getFullYear();
  const previousMonthNumber = previousFirst.getMonth() + 1;
  const monthLabel = previousFirst.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDay = `${previousYear}-${String(previousMonthNumber).padStart(2, "0")}-01`;
  const currentFirst = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Employee payroll: HR/Admin handle review and approval.
  await pool.query(
    `INSERT INTO salary_records
      (user_id, month, basic_salary, hra, allowances, overtime_pay,
       gross_salary, deductions, net_salary, amount, status)
     SELECT
       u.id, $1,
       COALESCE(u.salary_basic, 0),
       COALESCE(u.salary_hra, 0),
       COALESCE(u.salary_allowances, 0),
       0,
       COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0),
       COALESCE(u.salary_deductions,0),
       COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
       COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
       'Pending Review'
     FROM users u
     WHERE LOWER(u.role) = 'employee'
       AND COALESCE(u.permanent, true) = true
       AND (u.joining_date IS NULL OR u.joining_date < $2::date)
       AND (u.end_date IS NULL OR u.end_date >= $3::date)
     ON CONFLICT (user_id, month) DO NOTHING`,
    [monthLabel, currentFirst, firstDay]
  );

  // HR/Admin payroll: CEO is the final approver.
  await pool.query(
    `INSERT INTO salary_records
      (user_id, month, basic_salary, hra, allowances, overtime_pay,
       gross_salary, deductions, net_salary, amount, status)
     SELECT
       u.id, $1,
       COALESCE(u.salary_basic, 0),
       COALESCE(u.salary_hra, 0),
       COALESCE(u.salary_allowances, 0),
       0,
       COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0),
       COALESCE(u.salary_deductions,0),
       COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
       COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
       'Pending Review'
     FROM users u
     WHERE LOWER(u.role) IN ('admin','hr')
       AND (u.joining_date IS NULL OR u.joining_date < $2::date)
       AND (u.end_date IS NULL OR u.end_date >= $3::date)
     ON CONFLICT (user_id, month) DO NOTHING`,
    [monthLabel, currentFirst, firstDay]
  );

  console.log(`Previous-month payroll generation checked for ${monthLabel}.`);
}

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`TrioByte backend running on http://localhost:${PORT}`);
  generatePreviousMonthPayroll().catch((error) => console.error("MONTHLY PAYROLL ERROR:", error));
});

setInterval(() => {
  generatePreviousMonthPayroll().catch((error) => console.error("MONTHLY PAYROLL ERROR:", error));
}, 60 * 60 * 1000);
