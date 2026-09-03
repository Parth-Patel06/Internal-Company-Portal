const pool = require("./pool");
const bcrypt = require("bcryptjs");

async function seed() {
  const client = await pool.connect();

  try {
    console.log("Cleaning old demo data...");

    await client.query("BEGIN");

    /*
      Delete child tables first because of foreign key constraints.
    */

    await client.query(`
      DELETE FROM chat_messages;
    `);

    await client.query(`
      DELETE FROM notifications;
    `);

    await client.query(`
      DELETE FROM login_logs;
    `);

    await client.query(`
      DELETE FROM repositories;
    `);

    await client.query(`
      DELETE FROM overtime;
    `);

    await client.query(`
      DELETE FROM salary_records;
    `);

    await client.query(`
      DELETE FROM announcements;
    `);

    await client.query(`
      DELETE FROM daily_work_logs;
    `);

    await client.query(`
      DELETE FROM leave_requests;
    `);

    await client.query(`
      DELETE FROM attendance;
    `);

    await client.query(`
      DELETE FROM tasks;
    `);

    await client.query(`
      DELETE FROM projects;
    `);

    await client.query(`
      DELETE FROM users;
    `);

    /*
      Reset ID sequences where possible.
    */

    await client.query(`
      ALTER SEQUENCE users_id_seq RESTART WITH 1;
    `);

    /*
      Password for all demo accounts:
      Demo@123
    */

    const passwordHash = await bcrypt.hash("Demo@123", 10);

    console.log("Creating demo users...");

    /*
      IMPORTANT:

      Your users.role CHECK constraint allows:

      employee
      intern
      hr
      admin
      ceo

      Therefore all role values must be lowercase.
    */

    const users = [
      {
        employee_id: "TB-CEO-001",
        full_name: "Aarav Mehta",
        email: "ceo@triobyte.demo",
        role: "ceo",
        employment_type: "permanent",
        department: "Leadership",
        designation: "Founder & CEO",
        employee_level: "L10",
        mobile: "9876500001",
        address: "Ahmedabad HQ",
        joining_date: "2023-01-01",
        end_date: null,
        assigned_mentor: null,
        salary_basic: 0,
        salary_hra: 0,
        salary_allowances: 0,
        salary_deductions: 0
      },

      {
        employee_id: "TB-ADM-001",
        full_name: "Rahul Verma",
        email: "admin@triobyte.demo",
        role: "admin",
        employment_type: "permanent",
        department: "Operations",
        designation: "System Administrator",
        employee_level: "L7",
        mobile: "9876500002",
        address: "Ahmedabad",
        joining_date: "2023-03-10",
        end_date: null,
        assigned_mentor: null,
        salary_basic: 80000,
        salary_hra: 16000,
        salary_allowances: 10000,
        salary_deductions: 0
      },

      {
        employee_id: "TB-HR-001",
        full_name: "Priya Shah",
        email: "hr@triobyte.demo",
        role: "hr",
        employment_type: "permanent",
        department: "Human Resources",
        designation: "HR Manager",
        employee_level: "L6",
        mobile: "9876500003",
        address: "Ahmedabad",
        joining_date: "2023-05-15",
        end_date: null,
        assigned_mentor: null,
        salary_basic: 70000,
        salary_hra: 14000,
        salary_allowances: 8000,
        salary_deductions: 0
      },

      {
        employee_id: "TB-EMP-001",
        full_name: "Alex Johnson",
        email: "employee@triobyte.demo",
        role: "employee",
        employment_type: "permanent",
        department: "Engineering",
        designation: "Software Developer",
        employee_level: "L3",
        mobile: "9876500004",
        address: "Vadodara",
        joining_date: "2025-01-01",
        end_date: null,
        assigned_mentor: "Rahul Verma",
        salary_basic: 40000,
        salary_hra: 8000,
        salary_allowances: 5000,
        salary_deductions: 0
      },

      {
        employee_id: "TB-EMP-002",
        full_name: "Neha Patel",
        email: "neha@triobyte.demo",
        role: "employee",
        employment_type: "permanent",
        department: "Design",
        designation: "UI/UX Designer",
        employee_level: "L2",
        mobile: "9876500005",
        address: "Anand",
        joining_date: "2025-02-01",
        end_date: null,
        assigned_mentor: "Priya Shah",
        salary_basic: 43000,
        salary_hra: 9000,
        salary_allowances: 8000,
        salary_deductions: 0
      },

      {
        employee_id: "TB-INT-001",
        full_name: "Kunal Joshi",
        email: "intern@triobyte.demo",
        role: "intern",
        employment_type: "internship",
        department: "Engineering",
        designation: "Software Intern",
        employee_level: "Intern",
        mobile: "9876500006",
        address: "Anand",
        joining_date: "2026-06-01",
        end_date: "2026-12-31",
        assigned_mentor: "Alex Johnson",
        salary_basic: 15000,
        salary_hra: 0,
        salary_allowances: 2000,
        salary_deductions: 0
      }
    ];

    const ids = {};

    for (const user of users) {
      const result = await client.query(
        `
        INSERT INTO users (
          employee_id,
          full_name,
          email,
          password_hash,
          role,
          employment_type,
          department,
          designation,
          employee_level,
          mobile,
          address,
          joining_date,
          end_date,
          assigned_mentor,
          salary_basic,
          salary_hra,
          salary_allowances,
          salary_deductions,
          must_change_password
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19
        )
        RETURNING id, email
        `,
        [
          user.employee_id,
          user.full_name,
          user.email,
          passwordHash,
          user.role,
          user.employment_type,
          user.department,
          user.designation,
          user.employee_level,
          user.mobile,
          user.address,
          user.joining_date,
          user.end_date,
          user.assigned_mentor,
          user.salary_basic || 0,
          user.salary_hra || 0,
          user.salary_allowances || 0,
          user.salary_deductions || 0,
          ["employee", "intern"].includes(user.role.toLowerCase())
        ]
      );

      ids[result.rows[0].email] = result.rows[0].id;
    }

    console.log("Creating demo project...");

    /*
      Actual projects table:

      id
      name
      description
      status
      deadline
      progress
      created_by
    */

    const projectResult = await client.query(
      `
      INSERT INTO projects (
        name,
        description,
        status,
        deadline,
        progress,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        "TrioByte Portal",
        "Internal company portal demonstration project with role-based access control.",
        "Active",
        "2026-10-30",
        45,
        ids["admin@triobyte.demo"]
      ]
    );

    const projectId = projectResult.rows[0].id;

    console.log("Creating demo tasks...");

    /*
      Actual tasks table:

      id
      title
      description
      status
      priority
      deadline
      project_id
      assignee_id
      created_by
      created_at
    */

    await client.query(
      `
      INSERT INTO tasks (
        title,
        description,
        status,
        priority,
        deadline,
        project_id,
        assignee_id,
        created_by
      )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8),
        ($9, $10, $11, $12, $13, $14, $15, $16),
        ($17, $18, $19, $20, $21, $22, $23, $24)
      `,
      [
        "Profile Module",
        "Complete employee profile API and frontend integration.",
        "In Progress",
        "High",
        "2026-09-05",
        projectId,
        ids["employee@triobyte.demo"],
        ids["admin@triobyte.demo"],

        "Portal UI Improvements",
        "Improve dashboard design and responsive user interface.",
        "Pending",
        "Medium",
        "2026-09-10",
        projectId,
        ids["neha@triobyte.demo"],
        ids["admin@triobyte.demo"],

        "Intern Permission Testing",
        "Test restricted access and intern role permissions.",
        "Pending",
        "High",
        "2026-09-12",
        projectId,
        ids["intern@triobyte.demo"],
        ids["admin@triobyte.demo"]
      ]
    );

    console.log("Creating announcements...");

    /*
      Actual announcements table:

      id
      title
      body
      created_by
      created_at
    */

    await client.query(
      `
      INSERT INTO announcements (
        title,
        content,
        created_by
      )
      VALUES
        ($1, $2, $3),
        ($4, $5, $6)
      `,
      [
        "Welcome to TrioByte",
        "The complete demo portal is ready for role-based testing.",
        ids["hr@triobyte.demo"],

        "Password Policy",
        "New accounts must change their default password after their first login.",
        ids["hr@triobyte.demo"]
      ]
    );

    console.log("Creating previous-month salary records...");

    await client.query(
      `INSERT INTO salary_records (
        user_id, month, amount, basic_salary, hra, allowances, overtime_pay,
        gross_salary, deductions, net_salary, status
      )
      SELECT
        u.id,
        TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'FMMonth YYYY'),
        u.salary_basic + u.salary_hra + u.salary_allowances - u.salary_deductions,
        u.salary_basic,
        u.salary_hra,
        u.salary_allowances,
        0,
        u.salary_basic + u.salary_hra + u.salary_allowances,
        u.salary_deductions,
        u.salary_basic + u.salary_hra + u.salary_allowances - u.salary_deductions,
        'Pending Review'
      FROM users u
      WHERE LOWER(u.role) = 'employee'
    `
    );

    console.log("Creating attendance records...");

    /*
      Actual attendance table:

      id
      user_id
      work_date
      check_in
      check_out
    */

    await client.query(
      `
      INSERT INTO attendance (
        user_id,
        work_date,
        check_in,
        check_out
      )
      VALUES
        (
          $1,
          CURRENT_DATE,
          CURRENT_DATE + TIME '09:15',
          CURRENT_DATE + TIME '18:20'
        ),
        (
          $2,
          CURRENT_DATE,
          CURRENT_DATE + TIME '09:05',
          CURRENT_DATE + TIME '18:10'
        ),
        (
          $3,
          CURRENT_DATE,
          CURRENT_DATE + TIME '09:30',
          NULL
        )
      `,
      [
        ids["employee@triobyte.demo"],
        ids["neha@triobyte.demo"],
        ids["intern@triobyte.demo"]
      ]
    );

    console.log("Creating leave request...");

    /*
      Actual leave_requests table:

      id
      user_id
      leave_type
      start_date
      end_date
      reason
      status
      reviewed_by
    */

    await client.query(
      `
      INSERT INTO leave_requests (
        user_id,
        leave_type,
        from_date,
        to_date,
        reason,
        status,
        reviewed_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      `,
      [
        ids["employee@triobyte.demo"],
        "Casual Leave",
        "2026-09-15",
        "2026-09-16",
        "Family function",
        "Pending",
        null
      ]
    );

    await client.query("COMMIT");

    console.log("");
    console.log("====================================");
    console.log("Demo data seeded successfully!");
    console.log("====================================");
    console.log("");
    console.log("Demo login accounts:");
    console.log("");
    console.log("CEO:");
    console.log("ceo@triobyte.demo");
    console.log("");
    console.log("Admin:");
    console.log("admin@triobyte.demo");
    console.log("");
    console.log("HR:");
    console.log("hr@triobyte.demo");
    console.log("");
    console.log("Employee:");
    console.log("employee@triobyte.demo");
    console.log("");
    console.log("Employee 2:");
    console.log("neha@triobyte.demo");
    console.log("");
    console.log("Intern:");
    console.log("intern@triobyte.demo");
    console.log("");
    console.log("Password for all accounts:");
    console.log("Demo@123");
    console.log("");
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("");
    console.error("SEED ERROR:");
    console.error("");
    console.error(error);

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();