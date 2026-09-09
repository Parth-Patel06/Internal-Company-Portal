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
app.use("/uploads", express.static(require("path").join(__dirname, "uploads")));


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
      `SELECT c.id
       FROM chat_conversations c
       LEFT JOIN chat_members cm
         ON cm.conversation_id = c.id
        AND cm.user_id = $2
       WHERE c.id = $1
         AND (
           (c.conversation_type = 'direct' AND (c.user_one_id = $2 OR c.user_two_id = $2))
           OR
           (c.conversation_type = 'group' AND cm.user_id IS NOT NULL)
         )`,
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
  // Always evaluate the company cutoff in India Standard Time, independent
  // of the machine/database server timezone. The query also catches up if
  // the backend was offline at exactly 11:00 PM.
  return pool.query(`
    WITH clock AS (
      SELECT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' AS local_now
    )
    UPDATE login_logs
    SET logout_at = CURRENT_TIMESTAMP
    WHERE logout_at IS NULL
      AND (SELECT local_now::time FROM clock) >= TIME '23:00'
      AND login_at < (
        (SELECT local_now::date FROM clock) + TIME '23:00'
      ) AT TIME ZONE 'Asia/Kolkata'
  `).then((result) => {
    if (result.rowCount) {
      console.log(`End-of-day logout completed for ${result.rowCount} session(s).`);
    }
  }).catch((error) => {
    console.error("END-OF-DAY LOGOUT ERROR:", error);
  });
}

// Also close sessions left open from a previous company day. This protects
// against restarts/deployments that happen around the 11 PM cutoff.
function closeStaleSessions() {
  return pool.query(`
    UPDATE login_logs
    SET logout_at = CURRENT_TIMESTAMP
    WHERE logout_at IS NULL
      AND (login_at AT TIME ZONE 'Asia/Kolkata')::date <
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
  `).then((result) => {
    if (result.rowCount) {
      console.log(`Closed ${result.rowCount} stale session(s).`);
    }
  }).catch((error) => {
    console.error("STALE SESSION CLEANUP ERROR:", error);
  });
}

// Check once per minute. The database query is timezone-safe and catches up
// automatically if the backend was unavailable at exactly 11:00 PM IST.
setInterval(closeOpenSessionsAtEndOfDay, 60 * 1000);
closeStaleSessions();

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

// Salary and Overtime payroll generation is intentionally disabled.
// // Monthly payroll generation:
// // On the 1st of each month, create payroll for the PREVIOUS calendar month.
// // Days 2-7 are a catch-up window if the backend was offline on the 1st.
// async function generatePreviousMonthPayroll() {
//   const pool = require("./db/pool");
//   const now = new Date();
//   if (now.getDate() > 7) return;
//
//   const previousFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//   const previousYear = previousFirst.getFullYear();
//   const previousMonthNumber = previousFirst.getMonth() + 1;
//   const monthLabel = previousFirst.toLocaleString("en-US", { month: "long", year: "numeric" });
//   const firstDay = `${previousYear}-${String(previousMonthNumber).padStart(2, "0")}-01`;
//   const currentFirst = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
//
//   // Employee payroll: HR/Admin handle review and approval.
//   await pool.query(
//     `INSERT INTO salary_records
//       (user_id, month, basic_salary, hra, allowances, overtime_pay,
//        gross_salary, deductions, net_salary, amount, status)
//      SELECT
//        u.id, $1,
//        COALESCE(u.salary_basic, 0),
//        COALESCE(u.salary_hra, 0),
//        COALESCE(u.salary_allowances, 0),
//        0,
//        COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0),
//        COALESCE(u.salary_deductions,0),
//        COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
//        COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
//        'Pending Review'
//      FROM users u
//      WHERE LOWER(u.role) = 'employee'
//        AND COALESCE(u.permanent, true) = true
//        AND (u.joining_date IS NULL OR u.joining_date < $2::date)
//        AND (u.end_date IS NULL OR u.end_date >= $3::date)
//      ON CONFLICT (user_id, month) DO NOTHING`,
//     [monthLabel, currentFirst, firstDay]
//   );
//
//   // HR/Admin payroll: CEO is the final approver.
//   await pool.query(
//     `INSERT INTO salary_records
//       (user_id, month, basic_salary, hra, allowances, overtime_pay,
//        gross_salary, deductions, net_salary, amount, status)
//      SELECT
//        u.id, $1,
//        COALESCE(u.salary_basic, 0),
//        COALESCE(u.salary_hra, 0),
//        COALESCE(u.salary_allowances, 0),
//        0,
//        COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0),
//        COALESCE(u.salary_deductions,0),
//        COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
//        COALESCE(u.salary_basic,0) + COALESCE(u.salary_hra,0) + COALESCE(u.salary_allowances,0) - COALESCE(u.salary_deductions,0),
//        'Pending Review'
//      FROM users u
//      WHERE LOWER(u.role) IN ('admin','hr')
//        AND (u.joining_date IS NULL OR u.joining_date < $2::date)
//        AND (u.end_date IS NULL OR u.end_date >= $3::date)
//      ON CONFLICT (user_id, month) DO NOTHING`,
//     [monthLabel, currentFirst, firstDay]
//   );
//
//   console.log(`Previous-month payroll generation checked for ${monthLabel}.`);
// }
const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`TrioByte backend running on http://localhost:${PORT}`);
});
