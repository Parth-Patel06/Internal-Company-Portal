const router = require("express").Router();
const pool = require("../db/pool");
const bcrypt = require("bcryptjs");
const { auth, allow } = require("../middleware/auth");

router.use(auth);

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;

function roleOf(user) {
  return String(user.role || "")
    .trim()
    .toUpperCase();
}

function isManagement(user) {
  return ["CEO", "ADMIN", "HR"].includes(roleOf(user));
}

function isCEO(user) {
  return roleOf(user) === "CEO";
}

function isAdminOrCEO(user) {
  return ["CEO", "ADMIN"].includes(roleOf(user));
}

function ownOrManagement(user, userColumn = "user_id") {
  return isManagement(user)
    ? { where: "", params: [] }
    : { where: ` WHERE ${userColumn} = $1`, params: [user.id] };
}

/* ==================== PROJECT PERMISSIONS ==================== */

async function getProjectAccess(projectId, user) {
  const role = roleOf(user);

  // CEO and Admin can manage every project
  if (["CEO", "ADMIN"].includes(role)) {
    return {
      exists: true,
      canView: true,
      canManage: true,
      isLead: false,
      isMember: false
    };
  }

  const projectRows = await q(
    `SELECT id, lead_id, created_by
     FROM projects
     WHERE id = $1`,
    [projectId]
  );

  const project = projectRows[0];

  if (!project) {
    return {
      exists: false,
      canView: false,
      canManage: false,
      isLead: false,
      isMember: false
    };
  }

  // Check whether this user is a selected project member
  const memberRows = await q(
    `SELECT id
     FROM project_members
     WHERE project_id = $1
       AND user_id = $2`,
    [projectId, user.id]
  );

  const isMember = memberRows.length > 0;

  // Check whether this user is the project lead
  const isLead = Number(project.lead_id) === Number(user.id);

  // HR can manage projects they created
  const isCreator =
    Number(project.created_by) === Number(user.id);

  const canManage =
    isLead ||
    (role === "HR" && isCreator);

  const canView =
    isLead ||
    isMember ||
    (role === "HR" && isCreator);

  return {
    exists: true,
    canView,
    canManage,
    isLead,
    isMember
  };
}

/* ==================== CURRENT USER ==================== */

router.get("/me", async (req, res) => {
  res.json(req.user);
});

/* ==================== PROFILE ==================== */

router.put("/profile", async (req, res) => {
  try {
    const fullName = String(req.body.full_name || "").trim();
    const mobile = String(req.body.mobile || "").trim();
    const address = String(req.body.address || "").trim();

    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const rows = await q(
      `UPDATE users
       SET full_name = $1,
           mobile = $2,
           address = $3
       WHERE id = $4
       RETURNING
         id, employee_id, full_name, email, role,
         department, designation, employee_level,
         company_id, mobile, address,
         joining_date, end_date, permanent,
         assigned_mentor, must_change_password`,
      [fullName, mobile, address, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: rows[0]
    });
  } catch (error) {
    console.error("PROFILE UPDATE ERROR:", error);
    res.status(500).json({ message: "Unable to update profile" });
  }
});


/* ==================== GLOBAL SEARCH ==================== */

router.get("/search", async (req, res) => {
  try {
    const term = String(req.query.q || "").trim();

    if (!term) {
      return res.json({ results: [] });
    }

    if (term.length < 2) {
      return res.json({ results: [] });
    }

    const pattern = `%${term}%`;
    const management = isManagement(req.user);
    const results = [];

    if (management) {
      const users = await q(
        `SELECT id, full_name, employee_id, email, role, department, designation
         FROM users
         WHERE full_name ILIKE $1
            OR employee_id ILIKE $1
            OR email ILIKE $1
            OR department ILIKE $1
            OR designation ILIKE $1
         ORDER BY full_name
         LIMIT 10`,
        [pattern]
      );

      results.push(...users.map((u) => ({
        id: `user-${u.id}`,
        type: "Employee",
        title: u.full_name,
        subtitle: [u.employee_id, u.designation || u.role, u.department].filter(Boolean).join(" · "),
        page: "Employees"
      })));
    }

    const projects = management
      ? await q(
          `SELECT id, name, description, status
           FROM projects
           WHERE name ILIKE $1
              OR COALESCE(description, '') ILIKE $1
              OR COALESCE(status, '') ILIKE $1
           ORDER BY name
           LIMIT 10`,
          [pattern]
        )
      : await q(
          `SELECT DISTINCT p.id, p.name, p.description, p.status
           FROM projects p
           LEFT JOIN project_members pm ON pm.project_id = p.id
           WHERE (p.lead_id = $2 OR pm.user_id = $2)
             AND (
               p.name ILIKE $1
               OR COALESCE(p.description, '') ILIKE $1
               OR COALESCE(p.status, '') ILIKE $1
             )
           ORDER BY p.name
           LIMIT 10`,
          [pattern, req.user.id]
        );

    results.push(...projects.map((p) => ({
      id: `project-${p.id}`,
      type: "Project",
      title: p.name,
      subtitle: [p.status, p.description].filter(Boolean).join(" · "),
      page: "Projects"
    })));

    for (const project of projects) {
      const progressRows = await q(
        `SELECT COALESCE(ROUND(AVG(ta.progress)), 0)::int AS progress
         FROM tasks t
         JOIN task_assignments ta ON ta.task_id = t.id
         WHERE t.project_id = $1`,
        [project.id]
      );
      project.progress = progressRows[0]?.progress ?? 0;
    }

    const tasks = management
      ? await q(
          `SELECT t.id, t.title, t.description, t.status, p.name AS project_name
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
           WHERE t.title ILIKE $1
              OR COALESCE(t.description, '') ILIKE $1
              OR COALESCE(t.status, '') ILIKE $1
              OR COALESCE(p.name, '') ILIKE $1
           ORDER BY t.id DESC
           LIMIT 10`,
          [pattern]
        )
      : await q(
          `SELECT DISTINCT t.id, t.title, t.description, t.status, p.name AS project_name
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN task_assignments ta ON ta.task_id = t.id
           WHERE (p.lead_id = $2 OR ta.user_id = $2)
             AND (
               t.title ILIKE $1
               OR COALESCE(t.description, '') ILIKE $1
               OR COALESCE(t.status, '') ILIKE $1
               OR COALESCE(p.name, '') ILIKE $1
             )
           ORDER BY t.id DESC
           LIMIT 10`,
          [pattern, req.user.id]
        );

    results.push(...tasks.map((t) => ({
      id: `task-${t.id}`,
      type: "Task",
      title: t.title,
      subtitle: [t.project_name, t.status, t.description].filter(Boolean).join(" · "),
      page: "Tasks"
    })));

    const announcements = await q(
      `SELECT id, title, content
       FROM announcements
       WHERE title ILIKE $1
          OR COALESCE(content, '') ILIKE $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [pattern]
    );

    results.push(...announcements.map((a) => ({
      id: `announcement-${a.id}`,
      type: "Announcement",
      title: a.title,
      subtitle: a.content || "",
      page: "Announcements"
    })));

    res.json({ results: results.slice(0, 40) });
  } catch (error) {
    console.error("GLOBAL SEARCH ERROR:", error);
    res.status(500).json({ message: "Unable to complete search" });
  }
});


/* ==================== NOTIFICATIONS ==================== */

async function createNotification(clientOrPool, userId, title, body = "") {
  if (!userId) return;
  await clientOrPool.query(
    `INSERT INTO notifications (user_id, title, body)
     VALUES ($1, $2, $3)`,
    [userId, title, body]
  );
}

router.get("/notifications", async (req, res) => {
  try {
    const rows = await q(
      `SELECT id, title, body, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY read ASC, created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread = rows.filter((row) => !row.read).length;
    res.json({ notifications: rows, unread });
  } catch (error) {
    console.error("NOTIFICATIONS ERROR:", error);
    res.status(500).json({ message: "Unable to load notifications" });
  }
});

router.put("/notifications/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(
      `UPDATE notifications
       SET read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(400).json({ message: "Unable to update notification" });
  }
});

router.put("/notifications/read-all", async (req, res) => {
  try {
    await q(
      `UPDATE notifications
       SET read = true
       WHERE user_id = $1 AND read = false`,
      [req.user.id]
    );
    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Unable to update notifications" });
  }
});

/* ==================== SESSION ACTIVITY ==================== */

router.post("/logout", async (req, res) => {
  try {
    await q(
      `UPDATE login_logs
       SET logout_at = NOW()
       WHERE id = (
         SELECT id
         FROM login_logs
         WHERE user_id = $1 AND logout_at IS NULL
         ORDER BY login_at DESC
         LIMIT 1
       )`,
      [req.user.id]
    );
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    res.status(500).json({ message: "Unable to record logout" });
  }
});

router.get("/activity", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  try {
    const rows = await q(
      `SELECT
         l.id,
         l.login_at,
         l.logout_at,
         u.full_name,
         u.employee_id,
         u.role,
         u.department,
         CASE
           WHEN l.logout_at IS NULL THEN 'Active'
           ELSE 'Logged Out'
         END AS session_status
       FROM login_logs l
       JOIN users u ON u.id = l.user_id
       ORDER BY l.login_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (error) {
    console.error("ACTIVITY ERROR:", error);
    res.status(500).json({ message: "Unable to load login activity" });
  }
});

/* ==================== PASSWORD ==================== */

router.put("/settings/password", async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const rows = await q(
      "SELECT password_hash, role, must_change_password FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const firstChange =
      ["EMPLOYEE", "INTERN"].includes(roleOf(user)) &&
      user.must_change_password === true;

    if (!firstChange) {
      if (!currentPassword) {
        return res.status(400).json({
          message: "Current password is required"
        });
      }

      const valid = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

      if (!valid) {
        return res.status(400).json({
          message: "Current password is incorrect"
        });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = false
       WHERE id = $2`,
      [passwordHash, req.user.id]
    );

    res.json({
      message: "Password updated successfully",
      mustChangePassword: false
    });
  } catch (error) {
    console.error("PASSWORD UPDATE ERROR:", error);
    res.status(500).json({ message: "Unable to update password" });
  }
});

/* ==================== DASHBOARD ==================== */

router.get("/dashboard", async (req, res) => {
  try {
    const management = isManagement(req.user);

    const projects = management
      ? await q(`SELECT p.* FROM projects p ORDER BY p.deadline NULLS LAST`)
      : await q(
          `SELECT DISTINCT p.*
           FROM projects p
           WHERE p.lead_id = $1
              OR EXISTS (
                SELECT 1 FROM project_members pm
                WHERE pm.project_id = p.id AND pm.user_id = $1
              )
           ORDER BY p.deadline NULLS LAST`,
          [req.user.id]
        );

    const tasks = management
      ? await q(
          `SELECT t.*, p.name AS project_name,
                  u.full_name AS assigned_by_name,
                  COUNT(ta.id)::int AS assignee_count,
                  COUNT(*) FILTER (WHERE ta.status = 'Completed')::int AS completed_count,
                  COALESCE(ROUND(AVG(ta.progress)), 0)::int AS overall_progress
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.created_by
           LEFT JOIN task_assignments ta ON ta.task_id = t.id
           GROUP BY t.id, p.name, u.full_name
           ORDER BY t.deadline NULLS LAST, t.id DESC`
        )
      : await q(
          `SELECT t.*, p.name AS project_name,
                  u.full_name AS assigned_by_name,
                  COUNT(all_ta.id)::int AS assignee_count,
                  COUNT(*) FILTER (WHERE all_ta.status = 'Completed')::int AS completed_count,
                  COALESCE(ROUND(AVG(all_ta.progress)), 0)::int AS overall_progress,
                  my_ta.status AS my_status,
                  my_ta.progress AS my_progress
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           LEFT JOIN users u ON u.id = t.created_by
           LEFT JOIN task_assignments all_ta ON all_ta.task_id = t.id
           LEFT JOIN task_assignments my_ta
             ON my_ta.task_id = t.id AND my_ta.user_id = $1
           WHERE p.lead_id = $1
              OR EXISTS (
                SELECT 1 FROM task_assignments mine
                WHERE mine.task_id = t.id AND mine.user_id = $1
              )
           GROUP BY t.id, p.name, u.full_name, my_ta.status, my_ta.progress
           ORDER BY t.deadline NULLS LAST, t.id DESC`,
          [req.user.id]
        );

    const announcements = await q(
      `SELECT a.*, u.full_name AS created_by_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT 5`
    );

    const stats = {
      team: management ? (await q("SELECT id FROM users")).length : 1,
      projects: projects.length,
      tasks: tasks.length
    };

    res.json({ projects, tasks, announcements, stats });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);
    res.status(500).json({ message: "Unable to load dashboard" });
  }
});

/* ==================== USERS ==================== */

router.get("/users", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  await completeDueOffboardings();
  const rows = await q(
    `SELECT
       id, employee_id, full_name, email, role,
       department, designation, employee_level,
       company_id, mobile, address,
       joining_date, end_date, permanent,
       assigned_mentor, blocked, employment_status, email_status,
       mailbox_retention_days, offboarding_started_at, offboarding_completed_at
     FROM users
     ORDER BY id`
  );

  res.json(rows);
});

router.post("/users", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  try {
    const b = req.body;

    if (!b.full_name || !b.email) {
      return res.status(400).json({
        message: "Full name and email are required"
      });
    }

    const role = String(b.role || "EMPLOYEE")
    .trim()
    .toUpperCase();

    if (!["CEO", "ADMIN", "HR", "EMPLOYEE", "INTERN"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (
      roleOf(req.user) === "HR" &&
      !["EMPLOYEE", "INTERN"].includes(role)
    ) {
      return res.status(403).json({
        message: "HR can create only Employee or Intern accounts"
      });
    }

    if (
      roleOf(req.user) === "ADMIN" &&
      role === "CEO"
    ) {
      return res.status(403).json({
        message: "Only the CEO can create another CEO account"
      });
    }

    const employeeId =
      b.employee_id || `TB-${Date.now().toString().slice(-6)}`;

    const defaultPassword = b.default_password || "Demo@123";
    const hash = await bcrypt.hash(defaultPassword, 10);

    const rows = await q(
      `INSERT INTO users (
        employee_id, full_name, email, password_hash, role,
        department, designation, employee_level, company_id,
        mobile, address, joining_date, end_date,
        permanent, assigned_mentor, must_change_password
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16
      )
      RETURNING
        id, employee_id, full_name, email, role,
        must_change_password`,
      [
        employeeId,
        b.full_name,
        String(b.email).trim().toLowerCase(),
        hash,
        role,
        b.department || "",
        b.designation || "",
        b.employee_level || (role === "INTERN" ? "Intern" : "L1"),
        b.company_id || employeeId,
        b.mobile || "",
        b.address || "",
        b.joining_date || null,
        b.end_date || null,
        role === "INTERN" ? false : b.permanent !== false,
        b.assigned_mentor || null,
        ["EMPLOYEE", "INTERN"].includes(role)
      ]
    );

    res.status(201).json({
      message: "Account created successfully",
      user: rows[0],
      defaultPassword
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    res.status(400).json({
      message: error.detail || error.message
    });
  }
});


/* ==================== BLOCK + OFFBOARDING ==================== */

const OFFBOARDING_FORWARD_EMAIL = process.env.OFFBOARDING_FORWARD_EMAIL || "hr@triobyte.demo";
const MANAGEMENT_ROLES = ["CEO", "ADMIN", "HR"];

function canBlockTarget(actor, target) {
  const actorRole = roleOf(actor);
  const targetRole = roleOf(target);

  // Only CEO, Admin and HR can block/unblock accounts.
  if (!MANAGEMENT_ROLES.includes(actorRole)) return false;

  // The CEO can never be blocked by anyone, including the CEO.
  if (targetRole === "CEO") return false;

  // Nobody can block/unblock their own account.
  if (Number(actor.id) === Number(target.id)) return false;

  // CEO/Admin/HR may block the remaining roles.
  return true;
}

function canOffboardTarget(actor, target) {
  const actorRole = roleOf(actor);
  const targetRole = roleOf(target);

  // Offboarding is a management action only.
  if (!MANAGEMENT_ROLES.includes(actorRole)) return false;

  // CEO is permanently protected.
  if (targetRole === "CEO") return false;

  // Nobody can offboard themselves.
  if (Number(actor.id) === Number(target.id)) return false;

  // CEO can offboard anyone except the CEO.
  if (actorRole === "CEO") return true;

  // Admin can offboard HR, Employees and Interns, but not Admins.
  if (actorRole === "ADMIN") {
    return ["HR", "EMPLOYEE", "INTERN"].includes(targetRole);
  }

  // HR can offboard Employees and Interns only.
  if (actorRole === "HR") {
    return ["EMPLOYEE", "INTERN"].includes(targetRole);
  }

  return false;
}

function canManageOffboarding(actor) {
  return MANAGEMENT_ROLES.includes(roleOf(actor));
}

async function archiveEmployeeWork(offboardingId, userId) {
  // Company work is copied into the permanent archive. Nothing in the
  // archive is deleted when an employee leaves.
  const projectRows = await q(
    `SELECT DISTINCT
       p.id,
       p.name,
       p.description,
       p.status,
       p.priority,
       p.progress,
       p.lead_id,
       p.created_by
     FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id
     WHERE p.lead_id = $1
        OR p.created_by = $1
        OR pm.user_id = $1`,
    [userId]
  );

  for (const project of projectRows) {
    await q(
      `INSERT INTO offboarding_work_archive
         (offboarding_id, user_id, entity_type, entity_id, snapshot)
       VALUES ($1, $2, 'PROJECT', $3, $4::jsonb)
       ON CONFLICT DO NOTHING`,
      [offboardingId, userId, project.id, JSON.stringify(project)]
    );
  }

  const taskRows = await q(
    `SELECT DISTINCT
       t.id,
       t.title,
       t.description,
       t.status,
       t.priority,
       t.start_date,
       t.deadline,
       t.project_id,
       t.assignee_id,
       t.created_by
     FROM tasks t
     WHERE t.assignee_id = $1
        OR t.created_by = $1`,
    [userId]
  );

  for (const task of taskRows) {
    await q(
      `INSERT INTO offboarding_work_archive
         (offboarding_id, user_id, entity_type, entity_id, snapshot)
       VALUES ($1, $2, 'TASK', $3, $4::jsonb)
       ON CONFLICT DO NOTHING`,
      [offboardingId, userId, task.id, JSON.stringify(task)]
    );
  }
}

async function completeDueOffboardings() {
  // The selected last working day remains cancellable for the whole day.
  // Completion happens the following day.
  await pool.query(
    `UPDATE users u
     SET employment_status = 'Exited',
         offboarding_completed_at = COALESCE(u.offboarding_completed_at, NOW())
     WHERE UPPER(COALESCE(u.employment_status, 'ACTIVE')) = 'OFFBOARDING'
       AND u.id IN (
         SELECT o.user_id
         FROM offboarding_records o
         WHERE o.status = 'IN_PROGRESS'
           AND o.last_working_day < CURRENT_DATE
       )`
  );

  await pool.query(
    `UPDATE offboarding_records
     SET status = 'COMPLETED',
         completed_at = COALESCE(completed_at, NOW())
     WHERE status = 'IN_PROGRESS'
       AND last_working_day < CURRENT_DATE`
  );
}

/* ==================== BLOCK ==================== */

router.post("/users/:id/block", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  try {
    const targetRows = await q(
      `SELECT id, employee_id, full_name, email, role, blocked, employment_status
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );
    const target = targetRows[0];

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canBlockTarget(req.user, target)) {
      return res.status(403).json({ message: "You cannot block this account" });
    }

    const status = String(target.employment_status || "ACTIVE").trim().toUpperCase();
    if (status === "OFFBOARDING" || status === "EXITED") {
      return res.status(409).json({ message: "This account is already inactive" });
    }

    if (target.blocked) {
      return res.status(409).json({ message: "Account is already blocked" });
    }

    const rows = await q(
      `UPDATE users
       SET blocked = TRUE
       WHERE id = $1
       RETURNING id, employee_id, full_name, email, role, blocked, employment_status`,
      [target.id]
    );

    await q(
      `INSERT INTO offboarding_audit_log
         (user_id, actor_id, action, details)
       VALUES ($1, $2, 'BLOCKED', $3)`,
      [
        target.id,
        req.user.id,
        JSON.stringify({
          reason: "Account blocked",
          access_disabled: true,
        }),
      ]
    );

    return res.json({
      ...rows[0],
      message: "Account blocked successfully.",
    });
  } catch (error) {
    console.error("BLOCK ERROR:", error);
    return res.status(500).json({ message: "Unable to block account." });
  }
});

router.post("/users/:id/unblock", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  try {
    const targetRows = await q(
      `SELECT id, employee_id, full_name, email, role, blocked, employment_status
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );
    const target = targetRows[0];

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canBlockTarget(req.user, target)) {
      return res.status(403).json({ message: "You cannot unblock this account" });
    }

    const status = String(target.employment_status || "ACTIVE").trim().toUpperCase();
    if (status !== "ACTIVE") {
      return res.status(409).json({ message: "Only active accounts can be unblocked" });
    }

    if (!target.blocked) {
      return res.status(409).json({ message: "Account is already active" });
    }

    const rows = await q(
      `UPDATE users
       SET blocked = FALSE
       WHERE id = $1
       RETURNING id, employee_id, full_name, email, role, blocked, employment_status`,
      [target.id]
    );

    await q(
      `INSERT INTO offboarding_audit_log
         (user_id, actor_id, action, details)
       VALUES ($1, $2, 'UNBLOCKED', $3)`,
      [
        target.id,
        req.user.id,
        JSON.stringify({
          reason: "Account unblocked",
          access_restored: true,
        }),
      ]
    );

    return res.json({
      ...rows[0],
      message: "Account unblocked successfully.",
    });
  } catch (error) {
    console.error("UNBLOCK ERROR:", error);
    return res.status(500).json({ message: "Unable to unblock account." });
  }
});

/* ==================== OFFBOARDING ==================== */

router.get("/users/:id/offboarding", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  try {
    const rows = await q(
      `SELECT
         u.id,
         u.employee_id,
         u.full_name,
         u.email,
         u.role,
         u.department,
         u.designation,
         u.employee_level,
         u.blocked,
         u.employment_status,
         u.email_status,
         u.mailbox_retention_days,
         u.auto_reply_enabled,
         u.forwarding_enabled,
         u.forwarding_email,
         u.mailbox_action,
         u.offboarding_started_at,
         u.offboarding_completed_at,
         o.id AS offboarding_id,
         o.last_working_day,
         o.exit_reason,
         o.manager_id,
         manager.full_name AS manager_name,
         o.notes,
         o.status AS offboarding_status,
         o.mailbox_retention_days AS record_retention_days,
         o.auto_reply_enabled AS record_auto_reply_enabled,
         o.forwarding_enabled AS record_forwarding_enabled,
         o.forwarding_email AS record_forwarding_email,
         o.mailbox_action AS record_mailbox_action,
         o.created_by,
         creator.full_name AS created_by_name,
         o.completed_by,
         o.created_at AS offboarding_created_at,
         o.completed_at AS offboarding_completed_at
       FROM users u
       LEFT JOIN LATERAL (
         SELECT *
         FROM offboarding_records x
         WHERE x.user_id = u.id
         ORDER BY x.id DESC
         LIMIT 1
       ) o ON TRUE
       LEFT JOIN users manager ON manager.id = o.manager_id
       LEFT JOIN users creator ON creator.id = o.created_by
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    const audit = await q(
      `SELECT
         l.id,
         l.offboarding_id,
         l.action,
         l.details,
         l.created_at,
         u.full_name AS performed_by_name
       FROM offboarding_audit_log l
       LEFT JOIN users u ON u.id = l.actor_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC, l.id DESC`,
      [req.params.id]
    );

    return res.json({ ...rows[0], audit });
  } catch (error) {
    console.error("GET OFFBOARDING ERROR:", error);
    return res.status(500).json({ message: "Unable to load offboarding details" });
  }
});

router.post("/users/:id/offboarding/start", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  const client = await pool.connect();

  try {
    const targetResult = await client.query(
      `SELECT
         id,
         employee_id,
         full_name,
         email,
         role,
         department,
         designation,
         blocked,
         employment_status
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );
    const target = targetResult.rows[0];

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canOffboardTarget(req.user, target)) {
      return res.status(403).json({
        message: "You do not have permission to offboard this employee",
      });
    }

    if (String(target.employment_status || "ACTIVE").trim().toUpperCase() !== "ACTIVE") {
      return res.status(409).json({
        message: "Only active users can be offboarded",
      });
    }

    // Offboarding starts from an active account. A separately blocked account
    // must first be handled through the block/unblock workflow.
    if (target.blocked) {
      return res.status(409).json({
        message: "Unblock the account before starting offboarding",
      });
    }

    const body = req.body || {};
    const lastWorkingDay = String(body.last_working_day || "").trim();
    const reason = String(body.reason || body.exit_reason || "").trim();
    const retentionDays = Number(body.retention_days);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWorkingDay)) {
      return res.status(400).json({
        message: "A valid last working day is required",
      });
    }

    if (!reason) {
      return res.status(400).json({
        message: "Reason for leaving is required",
      });
    }

    if (![30, 60, 90].includes(retentionDays)) {
      return res.status(400).json({
        message: "Retention period must be 30, 60, or 90 days",
      });
    }

    const dateCheck = await client.query(
      `SELECT ($1::date >= CURRENT_DATE) AS valid`,
      [lastWorkingDay]
    );

    if (!dateCheck.rows[0]?.valid) {
      return res.status(400).json({
        message: "Last working day cannot be before today",
      });
    }

    await client.query("BEGIN");

    // The database schema uses one offboarding record per employee.
    // Reuse a previous cancelled/completed record instead of inserting a
    // second row and violating the UNIQUE(user_id) constraint.
    const off = await client.query(
      `INSERT INTO offboarding_records (
         user_id,
         last_working_day,
         exit_reason,
         manager_id,
         notes,
         status,
         mailbox_retention_days,
         auto_reply_enabled,
         forwarding_enabled,
         forwarding_email,
         mailbox_action,
         created_by,
         completed_by,
         created_at,
         completed_at
       )
       VALUES (
         $1,
         $2,
         $3,
         NULL,
         NULL,
         'IN_PROGRESS',
         $4,
         TRUE,
         TRUE,
         $5,
         'Archive',
         $6,
         NULL,
         NOW(),
         NULL
       )
       ON CONFLICT (user_id) DO UPDATE SET
         last_working_day = EXCLUDED.last_working_day,
         exit_reason = EXCLUDED.exit_reason,
         manager_id = EXCLUDED.manager_id,
         notes = EXCLUDED.notes,
         status = 'IN_PROGRESS',
         mailbox_retention_days = EXCLUDED.mailbox_retention_days,
         auto_reply_enabled = EXCLUDED.auto_reply_enabled,
         forwarding_enabled = EXCLUDED.forwarding_enabled,
         forwarding_email = EXCLUDED.forwarding_email,
         mailbox_action = EXCLUDED.mailbox_action,
         created_by = EXCLUDED.created_by,
         completed_by = NULL,
         created_at = NOW(),
         completed_at = NULL
       RETURNING *`,
      [
        target.id,
        lastWorkingDay,
        reason,
        retentionDays,
        OFFBOARDING_FORWARD_EMAIL,
        req.user.id,
      ]
    );

    const offboardingId = off.rows[0].id;

    // Offboarding and manual blocking are separate features, but starting
    // offboarding immediately disables portal access as required by the
    // company policy. The blocked flag records that access state.
    await client.query(
      `UPDATE users
       SET employment_status = 'Offboarding',
           blocked = TRUE,
           email_status = 'Deactivated',
           mailbox_retention_days = $1,
           auto_reply_enabled = TRUE,
           forwarding_enabled = TRUE,
           forwarding_email = $2,
           mailbox_action = 'Archive',
           offboarding_started_at = NOW(),
           offboarding_completed_at = NULL,
           end_date = $3
       WHERE id = $4`,
      [retentionDays, OFFBOARDING_FORWARD_EMAIL, lastWorkingDay, target.id]
    );

    await client.query(
      `INSERT INTO offboarding_audit_log
         (offboarding_id, user_id, actor_id, action, details)
       VALUES ($1, $2, $3, 'OFFBOARDING_STARTED', $4)`,
      [
        offboardingId,
        target.id,
        req.user.id,
        JSON.stringify({
          last_working_day: lastWorkingDay,
          reason,
          retention_days: retentionDays,
          email_forward_to: OFFBOARDING_FORWARD_EMAIL,
          auto_reply: true,
          mailbox_action: "Archive",
          work_preserved: true,
          access_disabled_immediately: true,
        }),
      ]
    );

    await client.query("COMMIT");

    // Preserve company work after the offboarding record exists. Archive
    // failure must not undo account deactivation or the audit record.
    try {
      await archiveEmployeeWork(offboardingId, target.id);
    } catch (archiveError) {
      console.error("OFFBOARDING WORK ARCHIVE ERROR:", archiveError);
    }

    await completeDueOffboardings();

    return res.status(201).json({
      message: "Offboarding started successfully.",
      offboarding: off.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("START OFFBOARDING ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Offboarding is already in progress for this employee",
      });
    }

    return res.status(500).json({
      message: "Unable to start offboarding.",
    });
  } finally {
    client.release();
  }
});

router.post("/users/:id/offboarding/cancel", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  const client = await pool.connect();

  try {
    const targetResult = await client.query(
      `SELECT
         id,
         full_name,
         role,
         employment_status,
         blocked
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );
    const target = targetResult.rows[0];

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!canOffboardTarget(req.user, target)) {
      return res.status(403).json({
        message: "You do not have permission to cancel this offboarding",
      });
    }

    if (String(target.employment_status || "ACTIVE").trim().toUpperCase() !== "OFFBOARDING") {
      return res.status(409).json({
        message: "User is not currently being offboarded",
      });
    }

    const latest = await client.query(
      `SELECT id
       FROM offboarding_records
       WHERE user_id = $1
         AND status = 'IN_PROGRESS'
       ORDER BY id DESC
       LIMIT 1`,
      [target.id]
    );

    if (!latest.rows[0]) {
      return res.status(404).json({
        message: "Active offboarding record not found",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `UPDATE offboarding_records
       SET status = 'CANCELLED',
           completed_by = NULL,
           completed_at = NULL
       WHERE id = $1`,
      [latest.rows[0].id]
    );

    // Offboarding automatically disabled this account, so cancellation
    // restores the account to its pre-offboarding active state.
    await client.query(
      `UPDATE users
       SET employment_status = 'Active',
           blocked = FALSE,
           email_status = 'Active',
           mailbox_retention_days = NULL,
           auto_reply_enabled = FALSE,
           forwarding_enabled = FALSE,
           forwarding_email = NULL,
           mailbox_action = 'Archive',
           offboarding_started_at = NULL,
           offboarding_completed_at = NULL
       WHERE id = $1`,
      [target.id]
    );

    await client.query(
      `INSERT INTO offboarding_audit_log
         (offboarding_id, user_id, actor_id, action, details)
       VALUES ($1, $2, $3, 'OFFBOARDING_CANCELLED', $4)`,
      [
        latest.rows[0].id,
        target.id,
        req.user.id,
        JSON.stringify({
          restored_access: true,
          email_reactivated: true,
          cancellation_confirmed: true,
        }),
      ]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Offboarding cancelled. The account is active again.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("CANCEL OFFBOARDING ERROR:", error);
    return res.status(500).json({
      message: "Unable to cancel offboarding.",
    });
  } finally {
    client.release();
  }
});

router.get("/users/:id/archived-work", allow("CEO", "ADMIN", "HR"), async (req, res) => {
  try {
    const rows = await q(
      `SELECT
         entity_type,
         entity_id,
         snapshot,
         created_at
       FROM offboarding_work_archive
       WHERE user_id = $1
       ORDER BY entity_type, entity_id`,
      [req.params.id]
    );

    return res.json(rows);
  } catch (error) {
    console.error("ARCHIVED WORK ERROR:", error);
    return res.status(500).json({
      message: "Unable to load archived work.",
    });
  }
});

/* ==================== PROJECTS ==================== */


router.get("/projects", async (req, res) => {
  try {
    const rows = isManagement(req.user)
      ? await q(
          `SELECT
             p.*,
             lead.full_name AS lead_name,
             creator.full_name AS created_by_name,
             COUNT(pm.user_id)::int AS member_count,
             COALESCE(progress_data.progress, 0)::int AS progress
           FROM projects p
           LEFT JOIN users lead ON lead.id = p.lead_id
           LEFT JOIN users creator ON creator.id = p.created_by
           LEFT JOIN project_members pm ON pm.project_id = p.id
           LEFT JOIN LATERAL (
             SELECT ROUND(AVG(ta.progress)) AS progress
             FROM tasks t
             JOIN task_assignments ta ON ta.task_id = t.id
             WHERE t.project_id = p.id
           ) progress_data ON TRUE
           GROUP BY p.id, lead.full_name, creator.full_name, progress_data.progress
           ORDER BY p.deadline NULLS LAST, p.id DESC`
        )
      : await q(
          `SELECT
             p.*,
             lead.full_name AS lead_name,
             creator.full_name AS created_by_name,
             COUNT(all_pm.user_id)::int AS member_count,
             COALESCE(progress_data.progress, 0)::int AS progress
           FROM projects p
           LEFT JOIN users lead ON lead.id = p.lead_id
           LEFT JOIN users creator ON creator.id = p.created_by
           LEFT JOIN project_members all_pm
             ON all_pm.project_id = p.id
           LEFT JOIN LATERAL (
             SELECT ROUND(AVG(ta.progress)) AS progress
             FROM tasks t
             JOIN task_assignments ta ON ta.task_id = t.id
             WHERE t.project_id = p.id
           ) progress_data ON TRUE
           WHERE
             p.lead_id = $1
             OR EXISTS (
               SELECT 1
               FROM project_members my_pm
               WHERE my_pm.project_id = p.id
                 AND my_pm.user_id = $1
             )
           GROUP BY p.id, lead.full_name, creator.full_name, progress_data.progress
           ORDER BY p.deadline NULLS LAST, p.id DESC`,
          [req.user.id]
        );

    res.json(rows);
  } catch (error) {
    console.error("GET PROJECTS ERROR:", error);
    res.status(500).json({
      message: "Unable to load projects"
    });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    if (!projectId) {
      return res.status(400).json({
        message: "Invalid project ID"
      });
    }

    const projectRows = await q(
      `SELECT
         p.*,
         lead.full_name AS lead_name,
         creator.full_name AS created_by_name
       FROM projects p
       LEFT JOIN users lead ON lead.id = p.lead_id
       LEFT JOIN users creator ON creator.id = p.created_by
       WHERE p.id = $1`,
      [projectId]
    );

    const project = projectRows[0];

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    if (!isManagement(req.user)) {
      const access = await q(
        `SELECT 1
         FROM project_members
         WHERE project_id = $1
           AND user_id = $2`,
        [projectId, req.user.id]
      );

      const isLead = Number(project.lead_id) === Number(req.user.id);

      if (!isLead && access.length === 0) {
        return res.status(403).json({
          message: "You do not have access to this project"
        });
      }
    }

    const members = await q(
      `SELECT
         u.id,
         u.employee_id,
         u.full_name,
         u.email,
         u.role,
         u.department,
         u.designation,
         pm.joined_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.full_name`,
      [projectId]
    );

    res.json({
      project,
      members
    });
  } catch (error) {
    console.error("GET PROJECT ERROR:", error);
    res.status(500).json({
      message: "Unable to load project details"
    });
  }
});

router.post(
  "/projects",
  allow("CEO", "ADMIN", "HR"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const b = req.body;

      const name = String(b.name || "").trim();
      const description = String(b.description || "").trim();

      const leadId = b.lead_id
        ? Number(b.lead_id)
        : null;

      const memberIds = Array.isArray(b.member_ids)
        ? b.member_ids
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
        : [];

      const startDate = b.start_date || null;
      const deadline = b.deadline || null;

      const status = String(
        b.status || "Planning"
      ).trim();

      const priority = String(
        b.priority || "Medium"
      ).trim();

      if (!name) {
        return res.status(400).json({
          message: "Project name is required"
        });
      }

      /*
        HR restriction:
        HR can create projects,
        but cannot select CEO as lead/member.
      */
      const uniqueMemberIds = [
        ...new Set(memberIds)
      ];

      /*
        Add project lead automatically
        to the member list.
      */
      if (
        leadId &&
        !uniqueMemberIds.includes(leadId)
      ) {
        uniqueMemberIds.push(leadId);
      }

      await client.query("BEGIN");

      /*
        Validate lead if selected.
      */
      if (leadId) {
        const leadResult = await client.query(
          `SELECT id, role
           FROM users
           WHERE id = $1`,
          [leadId]
        );

        if (leadResult.rows.length === 0) {
          throw new Error("Selected project lead does not exist");
        }

        const leadRole = String(
          leadResult.rows[0].role || ""
        )
          .trim()
          .toUpperCase();

        if (
          roleOf(req.user) === "HR" &&
          leadRole === "CEO"
        ) {
          return res.status(403).json({
            message: "HR cannot assign CEO as project lead"
          });
        }
      }

      /*
        Validate all selected members.
      */
      if (uniqueMemberIds.length > 0) {
        const usersResult = await client.query(
          `SELECT id, role
           FROM users
           WHERE id = ANY($1::int[])`,
          [uniqueMemberIds]
        );

        if (
          usersResult.rows.length !==
          uniqueMemberIds.length
        ) {
          throw new Error(
            "One or more selected project members do not exist"
          );
        }

        if (roleOf(req.user) === "HR") {
          const hasCEO = usersResult.rows.some(
            (user) =>
              String(user.role || "")
                .trim()
                .toUpperCase() === "CEO"
          );

          if (hasCEO) {
            return res.status(403).json({
              message: "HR cannot add CEO to a project"
            });
          }
        }
      }

      /*
        Create the project.
      */
      const projectResult = await client.query(
        `INSERT INTO projects (
          name,
          description,
          lead_id,
          created_by,
          start_date,
          deadline,
          status,
          priority
        )
        VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,$8
        )
        RETURNING *`,
        [
          name,
          description,
          leadId,
          req.user.id,
          startDate,
          deadline,
          status,
          priority
        ]
      );

      const project = projectResult.rows[0];

      /*
        Add selected users to project_members.
      */
      for (const userId of uniqueMemberIds) {
        await client.query(
          `INSERT INTO project_members (
            project_id,
            user_id
          )
          VALUES ($1,$2)
          ON CONFLICT (
            project_id,
            user_id
          ) DO NOTHING`,
          [
            project.id,
            userId
          ]
        );
      }

      const projectRecipients = [...new Set(
        [...uniqueMemberIds, leadId].filter(Boolean)
      )].filter((userId) => Number(userId) !== Number(req.user.id));

      for (const userId of projectRecipients) {
        await createNotification(
          client,
          userId,
          "Added to project",
          `You were added to the project "${project.name}".`
        );
      }

      await client.query("COMMIT");

      const members = await q(
        `SELECT
           u.id,
           u.employee_id,
           u.full_name,
           u.email,
           u.role
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = $1
         ORDER BY u.full_name`,
        [project.id]
      );

      res.status(201).json({
        message: "Project created successfully",
        project,
        members
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "CREATE PROJECT ERROR:",
        error
      );

      res.status(400).json({
        message:
          error.detail ||
          error.message ||
          "Unable to create project"
      });

    } finally {
      client.release();
    }
  }
);




/* ==================== PROJECT EDIT / PHASE ==================== */

const PROJECT_PHASES = ["Planning", "Active", "Review", "Completed"];

async function getProjectProgress(projectId) {
  const rows = await q(
    `SELECT COALESCE(ROUND(AVG(ta.progress)), 0)::int AS progress
     FROM tasks t JOIN task_assignments ta ON ta.task_id = t.id
     WHERE t.project_id = $1`,
    [projectId]
  );
  return Number(rows[0]?.progress || 0);
}

router.put("/projects/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const projectId = Number(req.params.id);
    const access = await getProjectAccess(projectId, req.user);
    if (!projectId || !access.exists) return res.status(404).json({ message: "Project not found" });
    if (!(isManagement(req.user) || access.isLead)) return res.status(403).json({ message: "Only management or the project lead can edit this project" });

    const current = (await q(`SELECT * FROM projects WHERE id=$1`, [projectId]))[0];
    const b=req.body||{}, management=isManagement(req.user);
    const name=management ? String(b.name ?? current.name).trim() : current.name;
    if (!name) return res.status(400).json({ message: "Project name is required" });

    const description=String(b.description ?? current.description ?? "").trim();
    const startDate=b.start_date===undefined ? current.start_date : (b.start_date||null);
    const deadline=b.deadline===undefined ? current.deadline : (b.deadline||null);
    if (startDate && deadline && new Date(deadline)<new Date(startDate)) return res.status(400).json({ message: "Deadline cannot be before the start date" });

    let leadId=current.lead_id, memberIds=null;
    if (management) {
      leadId=b.lead_id ? Number(b.lead_id) : null;
      memberIds=Array.isArray(b.member_ids) ? [...new Set(b.member_ids.map(Number).filter(Number.isInteger))] : null;
      if (memberIds && leadId && !memberIds.includes(leadId)) memberIds.push(leadId);
      if (leadId && !(await q(`SELECT id FROM users WHERE id=$1`,[leadId]))[0]) return res.status(400).json({ message: "Selected project lead does not exist" });
      if (memberIds) {
        const users=await q(`SELECT id FROM users WHERE id=ANY($1::int[])`,[memberIds]);
        if (users.length!==memberIds.length) return res.status(400).json({ message: "One or more selected project members do not exist" });
      }
    }

    await client.query("BEGIN");
    const updated=await client.query(
      `UPDATE projects SET name=$1,description=$2,lead_id=$3,start_date=$4,deadline=$5,status=$6,priority=$7 WHERE id=$8 RETURNING *`,
      [name,description,leadId,startDate,deadline,String(b.status??current.status??"Planning"),String(b.priority??current.priority??"Medium"),projectId]
    );
    if (management && memberIds) {
      await client.query(`DELETE FROM project_members WHERE project_id=$1`,[projectId]);
      for (const userId of memberIds) await client.query(`INSERT INTO project_members(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[projectId,userId]);
    }
    await client.query("COMMIT");
    res.json({message:"Project updated successfully",project:updated.rows[0]});
  } catch(error) {
    await client.query("ROLLBACK");
    console.error("UPDATE PROJECT ERROR:",error);
    res.status(400).json({message:error.detail||error.message||"Unable to update project"});
  } finally { client.release(); }
});

router.post("/projects/:id/next-phase", async (req, res) => {
  const client = await pool.connect();

  try {
    const projectId = Number(req.params.id);
    const access = await getProjectAccess(projectId, req.user);

    if (!projectId || !access.exists) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!(isManagement(req.user) || access.isLead || access.isMember)) {
      return res.status(403).json({
        message: "You do not have permission to move this project"
      });
    }

    const progress = await getProjectProgress(projectId);

    if (progress < 100) {
      return res.status(400).json({
        message: `Project must reach 100% before the next phase. Current progress: ${progress}%`
      });
    }

    const project = (await q(
      `SELECT status FROM projects WHERE id=$1`,
      [projectId]
    ))[0];

    const currentIndex = PROJECT_PHASES.indexOf(project.status);
    const next = PROJECT_PHASES[currentIndex < 0 ? 0 : currentIndex + 1];

    if (!next) {
      return res.status(400).json({
        message: "This project is already in its final phase"
      });
    }

    await client.query("BEGIN");

    // Move the project to its next phase.
    const updated = await client.query(
      `UPDATE projects
       SET status=$1
       WHERE id=$2
       RETURNING *`,
      [next, projectId]
    );

    // A new phase starts from 0%.
    // Reset every assignment belonging to this project.
    await client.query(
      `UPDATE task_assignments ta
       SET progress=0,
           status='Not Started',
           started_at=NULL,
           completed_at=NULL
       FROM tasks t
       WHERE ta.task_id=t.id
         AND t.project_id=$1`,
      [projectId]
    );

    // Keep task-level status consistent with the reset assignments.
    await client.query(
      `UPDATE tasks
       SET status='Not Started'
       WHERE project_id=$1`,
      [projectId]
    );

    await client.query("COMMIT");

    res.json({
      message: `Project moved to ${next} phase. Progress has been reset to 0%.`,
      project: updated.rows[0],
      progress: 0
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("NEXT PROJECT PHASE ERROR:", error);
    res.status(400).json({
      message: error.message || "Unable to move project"
    });
  } finally {
    client.release();
  }
});

/* ==================== TASKS ==================== */

async function taskCanManage(taskId, user) {
  if (isManagement(user)) return true;

  const rows = await q(
    `SELECT p.lead_id
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1`,
    [taskId]
  );

  return rows[0] && Number(rows[0].lead_id) === Number(user.id);
}

router.post("/tasks", async (req, res) => {
  const client = await pool.connect();

  try {
    const b = req.body;
    const title = String(b.title || "").trim();
    const projectId = Number(b.project_id);
    const assigneeIds = [...new Set(
      (Array.isArray(b.assignee_ids) ? b.assignee_ids : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (!title) return res.status(400).json({ message: "Task title is required" });
    if (!projectId) return res.status(400).json({ message: "A project is required" });
    if (!assigneeIds.length) return res.status(400).json({ message: "Select at least one project member" });

    const access = await getProjectAccess(projectId, req.user);
    if (!access.exists) return res.status(404).json({ message: "Project not found" });
    if (!(isManagement(req.user) || access.isLead)) {
      return res.status(403).json({ message: "Only management or the project lead can create this task" });
    }

    const validMembers = await q(
      `SELECT user_id FROM project_members
       WHERE project_id = $1 AND user_id = ANY($2::int[])`,
      [projectId, assigneeIds]
    );

    if (validMembers.length !== assigneeIds.length) {
      return res.status(400).json({ message: "Tasks can only be assigned to members of the selected project" });
    }

    await client.query("BEGIN");

    const taskResult = await client.query(
      `INSERT INTO tasks
       (title, description, project_id, created_by, start_date, deadline, status, priority)
       VALUES ($1,$2,$3,$4,$5,$6,'Not Started',$7)
       RETURNING *`,
      [
        title,
        String(b.description || "").trim(),
        projectId,
        req.user.id,
        b.start_date || null,
        b.deadline || null,
        String(b.priority || "Medium")
      ]
    );

    const task = taskResult.rows[0];

    for (const userId of assigneeIds) {
      await client.query(
        `INSERT INTO task_assignments (task_id, user_id, status, progress)
         VALUES ($1,$2,'Not Started',0)`,
        [task.id, userId]
      );

      if (Number(userId) !== Number(req.user.id)) {
        await createNotification(
          client,
          userId,
          "New task assigned",
          `You were assigned "${task.title}".`
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CREATE TASK ERROR:", error);
    res.status(400).json({ message: error.detail || error.message || "Unable to create task" });
  } finally {
    client.release();
  }
});

router.put("/tasks/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId) return res.status(400).json({ message: "Invalid task ID" });

    if (!(await taskCanManage(taskId, req.user))) {
      return res.status(403).json({ message: "You cannot edit this task" });
    }

    const b = req.body;
    const title = String(b.title || "").trim();
    if (!title) return res.status(400).json({ message: "Task title is required" });

    const rows = await q(
      `UPDATE tasks
       SET title=$1, description=$2, start_date=$3, deadline=$4, priority=$5
       WHERE id=$6
       RETURNING *`,
      [title, String(b.description || "").trim(), b.start_date || null,
       b.deadline || null, String(b.priority || "Medium"), taskId]
    );

    if (!rows[0]) return res.status(404).json({ message: "Task not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("UPDATE TASK ERROR:", error);
    res.status(400).json({ message: error.detail || error.message || "Unable to update task" });
  }
});

router.put("/tasks/:id/progress", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const progress = Number(req.body.progress);

    if (!taskId || !Number.isFinite(progress) || progress < 0 || progress > 100) {
      return res.status(400).json({ message: "Progress must be between 0 and 100" });
    }

    const assignmentRows = await q(
      `SELECT id FROM task_assignments
       WHERE task_id=$1 AND user_id=$2`,
      [taskId, req.user.id]
    );

    if (!assignmentRows[0]) {
      return res.status(403).json({ message: "You can only update your own assigned task progress" });
    }

    const status = progress === 0 ? "Not Started" : progress === 100 ? "Completed" : "In Progress";

    const rows = await q(
      `UPDATE task_assignments
       SET progress=$1,
           status=$2,
           started_at=CASE WHEN $1 > 0 AND started_at IS NULL THEN NOW() ELSE started_at END,
           completed_at=CASE WHEN $1 = 100 THEN NOW() ELSE NULL END
       WHERE task_id=$3 AND user_id=$4
       RETURNING *`,
      [progress, status, taskId, req.user.id]
    );

    const summary = await q(
      `SELECT COALESCE(ROUND(AVG(progress)),0)::int AS overall_progress,
              COUNT(*)::int AS assignee_count,
              COUNT(*) FILTER (WHERE status='Completed')::int AS completed_count
       FROM task_assignments WHERE task_id=$1`,
      [taskId]
    );

    const s = summary[0];
    const taskStatus = Number(s.assignee_count) > 0 && Number(s.completed_count) === Number(s.assignee_count)
      ? "Completed"
      : Number(s.overall_progress) > 0 ? "In Progress" : "Not Started";

    await q(`UPDATE tasks SET status=$1 WHERE id=$2`, [taskStatus, taskId]);

    res.json({ assignment: rows[0], ...s, status: taskStatus });
  } catch (error) {
    console.error("UPDATE TASK PROGRESS ERROR:", error);
    res.status(400).json({ message: error.detail || error.message || "Unable to update progress" });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!(await taskCanManage(taskId, req.user))) {
      return res.status(403).json({ message: "You cannot delete this task" });
    }

    const rows = await q(`DELETE FROM tasks WHERE id=$1 RETURNING id`, [taskId]);
    if (!rows[0]) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("DELETE TASK ERROR:", error);
    res.status(400).json({ message: error.message || "Unable to delete task" });
  }
});

/* ==================== ATTENDANCE ==================== */

router.get("/attendance", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT a.*, u.full_name, u.employee_id
         FROM attendance a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.work_date DESC`
      )
    : await q(
        `SELECT *
         FROM attendance
         WHERE user_id = $1
         ORDER BY work_date DESC`,
        [req.user.id]
      );

  res.json(rows);
});

/* ==================== LEAVE ==================== */

router.get("/leave", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT l.*, u.full_name, u.employee_id
         FROM leave_requests l
         LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.id DESC`
      )
    : await q(
        `SELECT *
         FROM leave_requests
         WHERE user_id = $1
         ORDER BY id DESC`,
        [req.user.id]
      );

  res.json(rows);
});

router.post("/leave", async (req, res) => {
  const { from_date, to_date, reason } = req.body;

  if (!from_date || !to_date) {
    return res.status(400).json({
      message: "From date and to date are required"
    });
  }

  const rows = await q(
    `INSERT INTO leave_requests (
      user_id, from_date, to_date, reason
    )
    VALUES ($1,$2,$3,$4)
    RETURNING *`,
    [req.user.id, from_date, to_date, reason || ""]
  );

  res.status(201).json(rows[0]);
});

router.put(
  "/leave/:id",
  allow("CEO", "ADMIN", "HR"),
  async (req, res) => {
    const status = String(req.body.status || "");

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid leave status" });
    }

    const rows = await q(
      `UPDATE leave_requests
       SET status = $1, reviewed_by = $2
       WHERE id = $3
       RETURNING *`,
      [status, req.user.id, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        message: "Leave request not found"
      });
    }

    res.json(rows[0]);
  }
);

/* ==================== DAILY WORK ==================== */

router.get("/daily-work", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT d.*, u.full_name, u.employee_id
         FROM daily_work_logs d
         LEFT JOIN users u ON u.id = d.user_id
         ORDER BY d.work_date DESC, d.id DESC`
      )
    : await q(
        `SELECT *
         FROM daily_work_logs
         WHERE user_id = $1
         ORDER BY work_date DESC, id DESC`,
        [req.user.id]
      );

  res.json(rows);
});

router.post("/daily-work", async (req, res) => {
  const content = String(req.body.content || "").trim();
  const progress = Number(req.body.progress || 0);

  if (!content) {
    return res.status(400).json({
      message: "Work log content is required"
    });
  }

  const rows = await q(
    `INSERT INTO daily_work_logs (
      user_id, content, progress
    )
    VALUES ($1,$2,$3)
    RETURNING *`,
    [req.user.id, content, progress]
  );

  res.status(201).json(rows[0]);
});

/* ==================== SALARY ==================== */

router.get("/salary", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT s.*, u.full_name, u.employee_id, u.role AS employee_role,
                u.department, u.designation,
                reviewer.full_name AS reviewed_by_name,
                approver.full_name AS approved_by_name,
                processor.full_name AS processed_by_name
         FROM salary_records s
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
         LEFT JOIN users approver ON approver.id = s.approved_by
         LEFT JOIN users processor ON processor.id = s.processed_by
         ORDER BY s.month DESC, s.id DESC`
      )
    : await q(
        `SELECT s.*, u.full_name, u.employee_id, u.role AS employee_role,
                u.department, u.designation,
                reviewer.full_name AS reviewed_by_name,
                approver.full_name AS approved_by_name,
                processor.full_name AS processed_by_name
         FROM salary_records s
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
         LEFT JOIN users approver ON approver.id = s.approved_by
         LEFT JOIN users processor ON processor.id = s.processed_by
         WHERE s.user_id = $1
         ORDER BY s.month DESC, s.id DESC`,
        [req.user.id]
      );

  res.json(rows);
});

/* ==================== OVERTIME ==================== */

router.get("/overtime", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT o.*, u.full_name, u.employee_id
         FROM overtime o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.work_date DESC, o.id DESC`
      )
    : await q(
        `SELECT *
         FROM overtime
         WHERE user_id = $1
         ORDER BY work_date DESC, id DESC`,
        [req.user.id]
      );

  res.json(rows);
});

/* ==================== ANNOUNCEMENTS ==================== */
/* Shared company data: every logged-in user can see these. */

router.get("/announcements", async (req, res) => {
  const rows = await q(
    `SELECT a.*, u.full_name AS created_by_name
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by
     ORDER BY a.created_at DESC`
  );

  res.json(rows);
});

router.post(
  "/announcements",
  allow("CEO", "ADMIN", "HR"),
  async (req, res) => {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();

    if (!title || !content) {
      return res.status(400).json({
        message: "Title and content are required"
      });
    }

    const rows = await q(
      `INSERT INTO announcements (
        title, content, created_by
      )
      VALUES ($1,$2,$3)
      RETURNING *`,
      [title, content, req.user.id]
    );

    res.status(201).json(rows[0]);
  }
);

/* ==================== REPOSITORIES ==================== */

router.get("/repos", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT r.*, p.name AS project_name,
                u.full_name AS owner_name
         FROM repositories r
         LEFT JOIN projects p ON p.id = r.project_id
         LEFT JOIN users u ON u.id = r.owner_id
         ORDER BY r.updated_at DESC`
      )
    : await q(
        `SELECT DISTINCT
           r.*,
           p.name AS project_name
         FROM repositories r
         LEFT JOIN projects p ON p.id = r.project_id
         WHERE
           r.owner_id = $1
           OR p.lead_id = $1
           OR EXISTS (
             SELECT 1
             FROM project_members pm
             WHERE pm.project_id = r.project_id
               AND pm.user_id = $1
           )
         ORDER BY r.updated_at DESC`,
        [req.user.id]
      );

  res.json(rows);
});

/* ==================== CHAT ==================== */

function canDeleteChatMessage(user) {
  return ["CEO", "ADMIN"].includes(roleOf(user));
}

async function ensureDirectConversation(userA, userB) {
  const a = Number(userA);
  const b = Number(userB);
  const one = Math.min(a, b);
  const two = Math.max(a, b);

  const rows = await q(
    `INSERT INTO chat_conversations
       (conversation_type, user_one_id, user_two_id)
     VALUES ('direct', $1, $2)
     ON CONFLICT (conversation_type, user_one_id, user_two_id)
     DO UPDATE SET conversation_type = EXCLUDED.conversation_type
     RETURNING id`,
    [one, two]
  );

  return rows[0].id;
}

async function canAccessConversation(conversationId, user) {
  if (isManagement(user)) return true;

  const rows = await q(
    `SELECT id
     FROM chat_conversations
     WHERE id = $1
       AND (user_one_id = $2 OR user_two_id = $2)`,
    [conversationId, user.id]
  );

  return rows.length > 0;
}

router.get("/chat/users", async (req, res) => {
  const rows = await q(
    `SELECT id, employee_id, full_name, email, role, employee_level
     FROM users
     WHERE id <> $1
       AND UPPER(COALESCE(employment_status, 'ACTIVE')) = 'ACTIVE'
     ORDER BY full_name ASC`,
    [req.user.id]
  );

  res.json(rows);
});

router.get("/chat/conversations", async (req, res) => {
  const rows = await q(
    `SELECT
       c.id,
       c.conversation_type,
       CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END AS other_user_id,
       u.full_name AS other_user_name,
       u.employee_id AS other_employee_id,
       u.role AS other_user_role,
       u.employee_level AS other_employee_level,
       lm.id AS last_message_id,
       lm.body AS last_message_body,
       lm.created_at AS last_message_at,
       lm.sender_id AS last_message_sender_id,
       COALESCE((
         SELECT COUNT(*)::int
         FROM chat_messages um
         WHERE um.conversation_id = c.id
           AND um.receiver_id = $1
           AND um.read_at IS NULL
           AND um.deleted_at IS NULL
       ), 0) AS unread_count
     FROM chat_conversations c
     JOIN users u
       ON u.id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
     LEFT JOIN LATERAL (
       SELECT id, body, created_at, sender_id
       FROM chat_messages
       WHERE conversation_id = c.id
         AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) lm ON TRUE
     WHERE c.conversation_type = 'direct'
       AND (c.user_one_id = $1 OR c.user_two_id = $1)
     ORDER BY lm.created_at DESC NULLS LAST, c.id DESC`,
    [req.user.id]
  );

  res.json(rows);
});

router.post("/chat/conversations", async (req, res) => {
  const otherUserId = Number(req.body.user_id);

  if (!otherUserId || otherUserId === Number(req.user.id)) {
    return res.status(400).json({ message: "Choose another employee." });
  }

  const target = await q(
    `SELECT id, full_name, employee_id, email, role, employee_level
     FROM users
     WHERE id = $1
       AND UPPER(COALESCE(employment_status, 'ACTIVE')) = 'ACTIVE'`,
    [otherUserId]
  );

  if (!target[0]) {
    return res.status(404).json({ message: "Employee not found or inactive." });
  }

  const id = await ensureDirectConversation(req.user.id, otherUserId);
  res.status(201).json({
    id,
    conversation_type: "direct",
    other_user_id: target[0].id,
    other_user_name: target[0].full_name,
    other_employee_id: target[0].employee_id,
    other_user_role: target[0].role,
    other_employee_level: target[0].employee_level
  });
});

router.get("/chat/conversations/:id/messages", async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId)) {
    return res.status(400).json({ message: "Invalid conversation ID." });
  }

  if (!(await canAccessConversation(conversationId, req.user))) {
    return res.status(403).json({ message: "You cannot access this conversation." });
  }

  // Only a participant's unread messages are marked read. Management monitoring
  // does not silently mark an employee's messages as read.
  if (!isManagement(req.user)) {
    await q(
      `UPDATE chat_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE conversation_id = $1
         AND receiver_id = $2
         AND read_at IS NULL
         AND deleted_at IS NULL`,
      [conversationId, req.user.id]
    );
  }

  const rows = await q(
    `SELECT
       c.id,
       c.conversation_id,
       c.sender_id,
       c.receiver_id,
       c.body,
       c.message_type,
       c.created_at,
       c.read_at,
       c.deleted_at,
       s.full_name AS sender_name,
       r.full_name AS receiver_name
     FROM chat_messages c
     LEFT JOIN users s ON s.id = c.sender_id
     LEFT JOIN users r ON r.id = c.receiver_id
     WHERE c.conversation_id = $1
       AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC, c.id ASC`,
    [conversationId]
  );

  res.json(rows);
});

router.post("/chat/conversations/:id/messages", async (req, res) => {
  const conversationId = Number(req.params.id);
  const body = String(req.body.body || "").trim();

  if (!Number.isInteger(conversationId) || !body) {
    return res.status(400).json({ message: "Conversation and message are required." });
  }

  if (body.length > 5000) {
    return res.status(400).json({ message: "Message is too long (maximum 5000 characters)." });
  }

  const conversation = await q(
    `SELECT id, user_one_id, user_two_id
     FROM chat_conversations
     WHERE id = $1 AND conversation_type = 'direct'`,
    [conversationId]
  );

  if (!conversation[0]) {
    return res.status(404).json({ message: "Conversation not found." });
  }

  const c = conversation[0];
  const recipientId = Number(c.user_one_id) === Number(req.user.id)
    ? c.user_two_id
    : Number(c.user_two_id) === Number(req.user.id)
      ? c.user_one_id
      : null;

  if (!recipientId) {
    return res.status(403).json({ message: "You cannot send messages in this conversation." });
  }

  const rows = await q(
    `INSERT INTO chat_messages
       (conversation_id, sender_id, receiver_id, body, message_type)
     VALUES ($1, $2, $3, $4, 'text')
     RETURNING id, conversation_id, sender_id, receiver_id, body, message_type, created_at, read_at, deleted_at`,
    [conversationId, req.user.id, recipientId, body]
  );

  const message = {
    ...rows[0],
    sender_name: req.user.full_name,
    receiver_name: (await q(`SELECT full_name FROM users WHERE id = $1`, [recipientId]))[0]?.full_name || ""
  };

  const io = req.app.locals.io;
  if (io) io.to(`chat:conversation:${conversationId}`).emit("chat:message", message);

  res.status(201).json(message);
});

router.post("/chat/conversations/:id/read", async (req, res) => {
  const conversationId = Number(req.params.id);
  if (!(await canAccessConversation(conversationId, req.user))) {
    return res.status(403).json({ message: "You cannot access this conversation." });
  }

  await q(
    `UPDATE chat_messages
     SET read_at = COALESCE(read_at, NOW())
     WHERE conversation_id = $1
       AND receiver_id = $2
       AND read_at IS NULL
       AND deleted_at IS NULL`,
    [conversationId, req.user.id]
  );

  const io = req.app.locals.io;
  if (io) io.to(`chat:conversation:${conversationId}`).emit("chat:read", {
    conversation_id: conversationId,
    reader_id: req.user.id
  });

  res.json({ ok: true });
});

router.delete("/chat/messages/:id", async (req, res) => {
  if (!canDeleteChatMessage(req.user)) {
    return res.status(403).json({
      message: "Only Admin and CEO can delete chat messages."
    });
  }

  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId)) {
    return res.status(400).json({ message: "Invalid message ID." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, conversation_id, sender_id, body, deleted_at
       FROM chat_messages
       WHERE id = $1
       FOR UPDATE`,
      [messageId]
    );

    const message = result.rows[0];
    if (!message) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Message not found." });
    }

    if (message.deleted_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Message has already been deleted." });
    }

    await client.query(
      `INSERT INTO chat_message_deletions
         (message_id, conversation_id, message_sender_id, message_body, deleted_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [message.id, message.conversation_id, message.sender_id, message.body, req.user.id]
    );

    await client.query(
      `UPDATE chat_messages
       SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2`,
      [req.user.id, message.id]
    );

    await client.query("COMMIT");

    const io = req.app.locals.io;
    if (io) io.to(`chat:conversation:${message.conversation_id}`).emit("chat:deleted", {
      message_id: message.id,
      conversation_id: message.conversation_id,
      deleted_by: req.user.id
    });

    res.json({ ok: true, message_id: message.id });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CHAT DELETE ERROR:", error);
    res.status(500).json({ message: "Unable to delete message." });
  } finally {
    client.release();
  }
});

/* Backward-compatible management history endpoint. Normal users receive only
   their own messages; Admin/HR/CEO can monitor all visible chat history. */
router.get("/chat", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT c.*, s.full_name AS sender_name, r.full_name AS receiver_name
         FROM chat_messages c
         LEFT JOIN users s ON s.id = c.sender_id
         LEFT JOIN users r ON r.id = c.receiver_id
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC`
      )
    : await q(
        `SELECT c.*, s.full_name AS sender_name, r.full_name AS receiver_name
         FROM chat_messages c
         LEFT JOIN users s ON s.id = c.sender_id
         LEFT JOIN users r ON r.id = c.receiver_id
         WHERE (c.sender_id = $1 OR c.receiver_id = $1)
           AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );

  res.json(rows);
});

/* Legacy direct-send endpoint retained for compatibility. New Chat UI uses
   conversation-scoped POST /chat/conversations/:id/messages. */
router.post("/chat", async (req, res) => {
  const receiverId = Number(req.body.receiver_id);
  const body = String(req.body.body || "").trim();

  if (!receiverId || !body) {
    return res.status(400).json({ message: "Receiver and message are required" });
  }

  if (receiverId === Number(req.user.id)) {
    return res.status(400).json({ message: "You cannot message yourself." });
  }

  const target = await q(
    `SELECT id FROM users WHERE id = $1 AND UPPER(COALESCE(employment_status, 'ACTIVE')) = 'ACTIVE'`,
    [receiverId]
  );
  if (!target[0]) return res.status(404).json({ message: "Receiver not found or inactive." });

  const conversationId = await ensureDirectConversation(req.user.id, receiverId);
  const rows = await q(
    `INSERT INTO chat_messages (conversation_id, sender_id, receiver_id, body, message_type)
     VALUES ($1, $2, $3, $4, 'text')
     RETURNING *`,
    [conversationId, req.user.id, receiverId, body]
  );

  const message = rows[0];
  const io = req.app.locals.io;
  if (io) io.to(`chat:conversation:${conversationId}`).emit("chat:message", message);
  res.status(201).json(message);
});

/* ==================== LOGIN LOGS ==================== */

router.get("/logs", async (req, res) => {
  const rows = isManagement(req.user)
    ? await q(
        `SELECT l.*, u.full_name, u.employee_id
         FROM login_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.id DESC`
      )
    : await q(
        `SELECT *
         FROM login_logs
         WHERE user_id = $1
         ORDER BY id DESC`,
        [req.user.id]
      );

  res.json(rows);
});

/* ==================== SALARY APPROVAL ====================
   Employee/Intern salary: HR or Admin may review/finalize.
   HR/Admin salary: CEO has final approval authority.
   CEO salary: not generated by the monthly payroll job. */
router.put("/salary/:id/approval", auth, async (req, res) => {
  try {
    const salaryId = Number(req.params.id);
    if (!Number.isInteger(salaryId)) {
      return res.status(400).json({ message: "Invalid salary ID" });
    }

    const { action = "approve" } = req.body || {};
    const current = await q(
      `SELECT s.*, u.role AS employee_role, u.full_name
       FROM salary_records s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [salaryId]
    );

    if (!current[0]) {
      return res.status(404).json({ message: "Salary record not found" });
    }

    const salary = current[0];
    const actor = String(req.user.role || "").toUpperCase();
    const targetRole = String(salary.employee_role || "").toUpperCase();
    const managementSalary = ["ADMIN", "HR"].includes(targetRole);

    if (action === "review") {
      if (managementSalary) {
        return res.status(403).json({ message: "HR/Admin salary requires CEO approval" });
      }
      if (!["HR", "ADMIN", "CEO"].includes(actor)) {
        return res.status(403).json({ message: "Only HR/Admin/CEO can review employee salary" });
      }
      const rows = await q(
        `UPDATE salary_records
         SET status = 'Reviewed', reviewed_by = $1, reviewed_at = NOW()
         WHERE id = $2 AND status IN ('Pending Review', 'Reviewed')
         RETURNING *`,
        [req.user.id, salaryId]
      );
      if (!rows[0]) return res.status(409).json({ message: "Salary cannot be reviewed in its current state" });
      return res.json({ ...rows[0], message: "Salary marked as reviewed." });
    }

    if (action === "send_back") {
      if (managementSalary && actor !== "CEO") {
        return res.status(403).json({ message: "Only CEO can send back Admin/HR salary" });
      }
      if (!managementSalary && !["HR", "ADMIN", "CEO"].includes(actor)) {
        return res.status(403).json({ message: "Only HR/Admin/CEO can send salary back" });
      }
      const rows = await q(
        `UPDATE salary_records
         SET status = 'Pending Review', reviewed_by = NULL, reviewed_at = NULL,
             processed_by = NULL, processed_at = NULL
         WHERE id = $1
         RETURNING *`,
        [salaryId]
      );
      return res.json({ ...rows[0], message: "Salary sent back for review." });
    }

    if (managementSalary) {
      if (actor !== "CEO") {
        return res.status(403).json({ message: "CEO approval is required for Admin/HR salary" });
      }
    } else if (!["HR", "ADMIN", "CEO"].includes(actor)) {
      return res.status(403).json({ message: "Only HR/Admin/CEO can approve employee salary" });
    }

    const rows = await q(
      `UPDATE salary_records
       SET status = 'Processed',
           reviewed_by = COALESCE(reviewed_by, $1),
           reviewed_at = COALESCE(reviewed_at, NOW()),
           approved_by = $1,
           approved_at = NOW(),
           processed_by = $1,
           processed_at = NOW()
       WHERE id = $2 AND status IN ('Pending Review', 'Reviewed')
       RETURNING *`,
      [req.user.id, salaryId]
    );
    if (!rows[0]) return res.status(409).json({ message: "Salary is already processed or unavailable" });

    // Notify the salary recipient.
    await q(
      `INSERT INTO notifications (user_id, title, body)
       VALUES ($1, $2, $3)`,
      [salary.user_id, "Salary Processed", `Your ${salary.month} salary has been processed.`]
    );

    return res.json({ ...rows[0], message: "Salary processed successfully." });
  } catch (error) {
    console.error("SALARY APPROVAL ERROR:", error);
    return res.status(500).json({ message: "Unable to update salary." });
  }
});

module.exports = router;
