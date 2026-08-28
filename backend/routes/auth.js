const router = require("express").Router();
const pool = require("../db/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = rows[0];

    if (
      !user ||
      user.blocked ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    await pool.query(
      "INSERT INTO login_logs(user_id) VALUES($1)",
      [user.id]
    ).catch(() => {});

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    const role = String(user.role || "").toUpperCase();

    const mustChangePassword =
      ["EMPLOYEE", "INTERN"].includes(role) &&
      user.must_change_password === true;

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

router.post("/forgot-password", async (req, res) => {
  res.json({
    message:
      "Demo mode: contact HR or Admin to reset your company password.",
  });
});

module.exports = router;
