const router = require("express").Router();
const pool = require("../db/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { auth, allow } = require("../middleware/auth");

function roleOf(user) {
  return String(user.role || "").toUpperCase();
}

/* Notify the people who are allowed to handle a reset request. */
async function notifyResetApprovers(targetUser) {
  try {
    const role = roleOf(targetUser);
    let approverRoles = [];

    if (["EMPLOYEE", "INTERN"].includes(role)) {
      approverRoles = ["HR", "ADMIN"];
    } else if (["HR", "ADMIN"].includes(role)) {
      approverRoles = ["CEO"];
    }

    if (!approverRoles.length) return;

    const { rows } = await pool.query(
      `SELECT id
       FROM users
       WHERE UPPER(role) = ANY($1::text[])`,
      [approverRoles]
    );

    for (const approver of rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body)
         VALUES ($1, $2, $3)`,
        [
          approver.id,
          "Password Reset Request",
          `${targetUser.full_name} (${targetUser.role}) has requested a password reset. Open Password Reset Requests to review it.`,
        ]
      );
    }
  } catch (error) {
    // Notification failure must never make the password-reset request fail.
    console.error("RESET REQUEST NOTIFICATION ERROR:", error);
  }
}

/* ============================================================
 * LOGIN
 * ============================================================ */

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Company email and password are required",
      });
    }

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.blocked === true) {
      return res.status(403).json({ message: "Account is blocked" });
    }

    if (String(user.employment_status || "Active").toUpperCase() !== "ACTIVE") {
      return res.status(403).json({ message: "Account is not active" });
    }

    if (String(user.email_status || "Active").toUpperCase() !== "ACTIVE") {
      return res.status(403).json({ message: "Company email is deactivated" });
    }

    await pool
      .query("INSERT INTO login_logs(user_id) VALUES($1)", [user.id])
      .catch(() => {});

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const mustChangePassword = user.must_change_password === true;

    return res.json({
      token,
      mustChangePassword,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      message: "Unable to sign in.",
    });
  }
});

/* ============================================================
 * FORGOT PASSWORD REQUEST
 * ============================================================ */

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Please enter your company email.",
      });
    }

    const { rows } = await pool.query(
      `SELECT id, full_name, email, role
       FROM users
       WHERE LOWER(email) = $1`,
      [email]
    );

    const user = rows[0];

    // Do not reveal whether an email exists.
    if (!user) {
      return res.json({
        message:
          "If the account exists, a password reset request has been submitted.",
      });
    }

    const role = roleOf(user);

    if (role === "CEO") {
      return res.status(400).json({
        message:
          "CEO password reset must be handled through the system administrator.",
      });
    }

    const existing = await pool.query(
      `SELECT id
       FROM password_reset_requests
       WHERE user_id = $1
         AND status = 'PENDING'
       LIMIT 1`,
      [user.id]
    );

    if (existing.rowCount > 0) {
      return res.json({
        message: "A password reset request is already pending.",
      });
    }

    const requested = await pool.query(
      `INSERT INTO password_reset_requests (
         user_id,
         requested_for_role,
         status,
         requested_at
       )
       VALUES ($1, $2, 'PENDING', NOW())
       RETURNING id, status, requested_at`,
      [user.id, role]
    );

    // This was the missing notification path: tell the correct authority.
    await notifyResetApprovers(user);

    return res.json({
      message:
        "Password reset request submitted. The authorized person will handle it.",
      request: requested.rows[0],
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Unable to submit password reset request.",
    });
  }
});

/* ============================================================
 * VIEW PASSWORD RESET REQUESTS
 * ============================================================ */

router.get(
  "/password-reset-requests",
  auth,
  allow("CEO", "ADMIN", "HR"),
  async (req, res) => {
    try {
      const role = roleOf(req.user);
      let result;

      if (role === "CEO") {
        result = await pool.query(`
          SELECT
            r.id,
            r.user_id,
            r.requested_for_role,
            r.status,
            r.requested_at,
            r.handled_at,
            u.full_name,
            u.employee_id,
            u.email,
            u.role,
            h.full_name AS handled_by_name
          FROM password_reset_requests r
          JOIN users u ON u.id = r.user_id
          LEFT JOIN users h ON h.id = r.handled_by
          WHERE r.requested_for_role IN ('HR', 'ADMIN')
          ORDER BY r.requested_at DESC
        `);
      } else {
        result = await pool.query(`
          SELECT
            r.id,
            r.user_id,
            r.requested_for_role,
            r.status,
            r.requested_at,
            r.handled_at,
            u.full_name,
            u.employee_id,
            u.email,
            u.role,
            h.full_name AS handled_by_name
          FROM password_reset_requests r
          JOIN users u ON u.id = r.user_id
          LEFT JOIN users h ON h.id = r.handled_by
          WHERE r.requested_for_role IN ('EMPLOYEE', 'INTERN')
          ORDER BY r.requested_at DESC
        `);
      }

      return res.json(result.rows);
    } catch (error) {
      console.error("PASSWORD RESET REQUEST LIST ERROR:", error);
      return res.status(500).json({
        message: "Unable to load password reset requests.",
      });
    }
  }
);

/* ============================================================
 * HANDLE PASSWORD RESET
 * ============================================================ */

router.put(
  "/password-reset-requests/:id/handle",
  auth,
  allow("CEO", "ADMIN", "HR"),
  async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const temporaryPassword = String(req.body.temporaryPassword || "");

      if (!Number.isInteger(requestId)) {
        return res.status(400).json({ message: "Invalid reset request." });
      }

      if (temporaryPassword.length < 6) {
        return res.status(400).json({
          message: "Temporary password must be at least 6 characters.",
        });
      }

      const requestResult = await pool.query(
        `SELECT
           r.*,
           u.full_name,
           u.email,
           u.role
         FROM password_reset_requests r
         JOIN users u ON u.id = r.user_id
         WHERE r.id = $1`,
        [requestId]
      );

      const request = requestResult.rows[0];

      if (!request) {
        return res.status(404).json({ message: "Password reset request not found." });
      }

      if (request.status !== "PENDING") {
        return res.status(400).json({
          message: "This password reset request has already been handled.",
        });
      }


      const actorRole = roleOf(req.user);
      const targetRole = roleOf(request);

      if (["EMPLOYEE", "INTERN"].includes(targetRole)) {
        if (!["HR", "ADMIN"].includes(actorRole)) {
          return res.status(403).json({
            message: "Only HR or Admin can reset this password.",
          });
        }
      } else if (["HR", "ADMIN"].includes(targetRole)) {
        if (actorRole !== "CEO") {
          return res.status(403).json({
            message: "Only the CEO can reset an HR or Admin password.",
          });
        }
      } else if (targetRole === "CEO") {
        return res.status(403).json({
          message: "CEO password cannot be reset through this workflow.",
        });
      } else {
        return res.status(403).json({
          message: "Password reset is not allowed for this role.",
        });
      }

      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             must_change_password = TRUE
         WHERE id = $2`,
        [passwordHash, request.user_id]
      );

      await pool.query(
        `UPDATE password_reset_requests
         SET status = 'COMPLETED',
             handled_by = $1,
             handled_at = NOW()
         WHERE id = $2`,
        [req.user.id, requestId]
      );

      await pool.query(
        `INSERT INTO notifications (user_id, title, body)
         VALUES ($1, $2, $3)`,
        [
          request.user_id,
          "Password Reset",
          "Your password has been reset by an authorized company administrator. Sign in using your temporary password and create a new personal password.",
        ]
      ).catch((error) => {
        console.error("PASSWORD RESET USER NOTIFICATION ERROR:", error);
      });

      return res.json({
        message:
          "Temporary password set successfully. The user must create a new password at next login.",
      });
    } catch (error) {
      console.error("HANDLE PASSWORD RESET ERROR:", error);
      return res.status(500).json({
        message: "Unable to handle password reset.",
      });
    }
  }
);

module.exports = router;
