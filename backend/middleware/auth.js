const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized - token missing",
      });
    }

    const data = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const { rows } = await pool.query(
      `SELECT
        id,
        employee_id,
        full_name,
        email,
        role,
        department,
        designation,
        employee_level,
        mobile,
        address,
        joining_date,
        end_date,
        employment_type,
        assigned_mentor,
        must_change_password,
        blocked
      FROM users
      WHERE id = $1`,
      [data.id]
    );

    if (!rows[0] || rows[0].blocked) {
      return res.status(403).json({
        message: "Account unavailable",
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired session",
    });
  }
}

function allow(...roles) {
  const allowedRoles = roles.map((role) =>
    String(role).toLowerCase()
  );

  return (req, res, next) => {
    if (
      !allowedRoles.includes(
        String(req.user.role || "").toLowerCase()
      )
    ) {
      return res.status(403).json({
        message: "Permission denied",
      });
    }

    next();
  };
}

module.exports = { auth, allow };
