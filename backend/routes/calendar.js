const router = require("express").Router();
const pool = require("../db/pool");
const { auth } = require("../middleware/auth");

router.get("/events", auth, async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Math.min(
      12,
      Math.max(1, Number(req.query.month) || new Date().getMonth() + 1)
    );

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);

    const role = String(req.user.role || "").toUpperCase();
    const management = ["CEO", "ADMIN", "HR"].includes(role);

    const events = [];

    const userParams = management
      ? [start, end]
      : [start, end, req.user.id];

    const userFilter = management
      ? ""
      : " AND user_id = $3";

    /* LOGIN SESSIONS */

    {
      const { rows } = await pool.query(
        `SELECT
           l.id,
           l.user_id,
           l.login_at,
           l.logout_at,
           u.full_name
         FROM login_logs l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE l.login_at >= $1::date
           AND l.login_at < ($2::date + INTERVAL '1 day')
           ${management ? "" : " AND l.user_id = $3"}
         ORDER BY l.login_at`,
        userParams
      );

      for (const row of rows) {
        events.push({
          id: `login-${row.id}`,
          type: "login",
          date: row.login_at.toISOString().slice(0, 10),
          time: row.login_at.toISOString().slice(11, 16),
          title: "Login session",
          person: management ? row.full_name : null,
          description: row.logout_at
            ? "Login and logout session recorded"
            : "Signed in to the company portal"
        });
      }
    }

    /* ATTENDANCE */

    {
      const { rows } = await pool.query(
        `SELECT
           a.*,
           u.full_name
         FROM attendance a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.work_date BETWEEN $1::date AND $2::date
           ${management ? "" : " AND a.user_id = $3"}
         ORDER BY a.work_date`,
        userParams
      );

      for (const row of rows) {
        events.push({
          id: `attendance-${row.id}`,
          type: "attendance",
          date: String(row.work_date).slice(0, 10),
          time: row.check_in ? String(row.check_in).slice(0, 5) : null,
          title: `Attendance: ${row.status || "Present"}`,
          person: management ? row.full_name : null,
          description: row.check_in
            ? `Check-in ${String(row.check_in).slice(0, 5)}${
                row.check_out
                  ? ` · Check-out ${String(row.check_out).slice(0, 5)}`
                  : ""
              }`
            : "Attendance record"
        });
      }
    }

    /* DAILY WORK */

    {
      const { rows } = await pool.query(
        `SELECT
           d.*,
           u.full_name
         FROM daily_work_logs d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.work_date BETWEEN $1::date AND $2::date
           ${management ? "" : " AND d.user_id = $3"}
         ORDER BY d.work_date, d.id`,
        userParams
      );

      for (const row of rows) {
        events.push({
          id: `work-${row.id}`,
          type: "work",
          date: String(row.work_date).slice(0, 10),
          title: "Work log",
          person: management ? row.full_name : null,
          description: row.content || "Daily work recorded"
        });
      }
    }

    /* LEAVE */

    {
      const { rows } = await pool.query(
        `SELECT
           l.*,
           u.full_name
         FROM leave_requests l
         LEFT JOIN users u ON u.id = l.user_id
         WHERE l.from_date <= $2::date
           AND l.to_date >= $1::date
           ${management ? "" : " AND l.user_id = $3"}
         ORDER BY l.from_date`,
        userParams
      );

      for (const row of rows) {
        events.push({
          id: `leave-${row.id}`,
          type: "leave",
          date: String(row.from_date).slice(0, 10),
          start_date: String(row.from_date).slice(0, 10),
          end_date: String(row.to_date).slice(0, 10),
          title: `${row.status || "Pending"} leave`,
          person: management ? row.full_name : null,
          description: row.reason || "Leave request"
        });
      }
    }

    /* TASK DEADLINES */

    {
      const { rows } = await pool.query(
        `SELECT
           t.*,
           u.full_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.deadline BETWEEN $1::date AND $2::date
           ${management ? "" : " AND t.assignee_id = $3"}
         ORDER BY t.deadline`,
        userParams
      );

      for (const row of rows) {
        events.push({
          id: `task-${row.id}`,
          type: "task",
          date: String(row.deadline).slice(0, 10),
          title: row.title || "Task deadline",
          person: management ? row.full_name : null,
          description: `${row.status || "Pending"} · ${
            row.priority || "Medium"
          } priority`
        });
      }
    }

    /* PROJECT DEADLINES */

    if (management) {
      const { rows } = await pool.query(
        `SELECT
           p.*,
           u.full_name
         FROM projects p
         LEFT JOIN users u ON u.id = p.created_by
         WHERE p.deadline BETWEEN $1::date AND $2::date
         ORDER BY p.deadline`,
        [start, end]
      );

      for (const row of rows) {
        events.push({
          id: `project-${row.id}`,
          type: "project",
          date: String(row.deadline).slice(0, 10),
          title: row.name || "Project deadline",
          person: row.full_name || null,
          description: row.status || "Project deadline"
        });
      }
    } else {
      const { rows } = await pool.query(
        `SELECT DISTINCT p.*
         FROM projects p
         JOIN tasks t ON t.project_id = p.id
         WHERE t.assignee_id = $1
           AND p.deadline BETWEEN $2::date AND $3::date
         ORDER BY p.deadline`,
        [req.user.id, start, end]
      );

      for (const row of rows) {
        events.push({
          id: `project-${row.id}`,
          type: "project",
          date: String(row.deadline).slice(0, 10),
          title: row.name || "Project deadline",
          description: row.status || "Project deadline"
        });
      }
    }

    events.sort((a, b) =>
      `${a.date || ""} ${a.time || ""}`.localeCompare(
        `${b.date || ""} ${b.time || ""}`
      )
    );

    res.json({
      year,
      month,
      events
    });
  } catch (error) {
    console.error("CALENDAR ERROR:", error);
    res.status(500).json({
      message: "Unable to load calendar events."
    });
  }
});

module.exports = router;
