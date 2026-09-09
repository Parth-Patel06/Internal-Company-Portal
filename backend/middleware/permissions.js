const pool = require("../db/pool");

async function getEffectivePermissions(userId) {
  const { rows } = await pool.query(`
    SELECT
      p.permission_key,
      p.permission_name,
      p.module,
      p.description,
      COALESCE(up.access, rp.access, 'DENY') AS access,
      CASE WHEN up.id IS NOT NULL THEN 'CUSTOM' ELSE 'ROLE' END AS source
    FROM users u
    CROSS JOIN permissions p
    LEFT JOIN role_permissions rp
      ON rp.role = UPPER(TRIM(u.role))
     AND rp.permission_id = p.id
    LEFT JOIN user_permissions up
      ON up.user_id = u.id
     AND up.permission_id = p.id
    WHERE u.id = $1
    ORDER BY p.module, p.permission_name
  `, [userId]);

  return rows;
}

async function hasPermission(userId, permissionKey) {
  const { rows } = await pool.query(`
    SELECT COALESCE(up.access, rp.access, 'DENY') AS access
    FROM users u
    JOIN permissions p ON p.permission_key = $2
    LEFT JOIN role_permissions rp
      ON rp.role = UPPER(TRIM(u.role))
     AND rp.permission_id = p.id
    LEFT JOIN user_permissions up
      ON up.user_id = u.id
     AND up.permission_id = p.id
    WHERE u.id = $1
    LIMIT 1
  `, [userId, permissionKey]);

  return rows[0]?.access === 'ALLOW';
}

function requireAnyPermission(...permissionKeys) {
  return async (req, res, next) => {
    try {
      for (const key of permissionKeys) {
        if (await hasPermission(req.user.id, key)) return next();
      }
      return res.status(403).json({ message: `Permission denied: ${permissionKeys.join(' or ')}` });
    } catch (error) {
      console.error('PERMISSION CHECK ERROR:', error);
      return res.status(500).json({ message: 'Unable to verify permissions' });
    }
  };
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    try {
      if (!(await hasPermission(req.user.id, permissionKey))) {
        return res.status(403).json({ message: `Permission denied: ${permissionKey}` });
      }
      next();
    } catch (error) {
      console.error('PERMISSION CHECK ERROR:', error);
      res.status(500).json({ message: 'Unable to verify permissions' });
    }
  };
}

module.exports = { getEffectivePermissions, hasPermission, requirePermission, requireAnyPermission };
