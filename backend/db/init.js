const pool = require("./pool");

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(30) UNIQUE NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,

        role VARCHAR(20) NOT NULL
  CHECK (
    UPPER(TRIM(role)) IN (
      'CEO',
      'ADMIN',
      'HR',
      'EMPLOYEE',
      'INTERN'
    )
  ),

        employment_type VARCHAR(30) DEFAULT 'permanent',

        department VARCHAR(100),
        designation VARCHAR(100),
        employee_level VARCHAR(30) DEFAULT 'L1',
        company_id VARCHAR(30),

        mobile VARCHAR(30),
        address TEXT,

        joining_date DATE,
        end_date DATE,

        permanent BOOLEAN DEFAULT TRUE,

        assigned_mentor VARCHAR(120),
        photo_url TEXT,

        must_change_password BOOLEAN DEFAULT FALSE,
        blocked BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,

  lead_id INT REFERENCES users(id),
  created_by INT REFERENCES users(id),

  start_date DATE,
  deadline DATE,

  status VARCHAR(30) DEFAULT 'Planning',
  priority VARCHAR(20) DEFAULT 'Medium',
  progress INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,

  project_id INT REFERENCES projects(id),
  assignee_id INT REFERENCES users(id),
  created_by INT REFERENCES users(id),

  deadline DATE,
  status VARCHAR(30) DEFAULT 'Pending',
  priority VARCHAR(20) DEFAULT 'Medium',

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id SERIAL PRIMARY KEY,

  task_id INT NOT NULL
    REFERENCES tasks(id) ON DELETE CASCADE,

  user_id INT NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  assigned_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(task_id, user_id)
);
      

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        work_date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        status VARCHAR(20) DEFAULT 'Present',
        UNIQUE(user_id, work_date)
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        leave_type VARCHAR(50) DEFAULT 'Leave',
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        reviewed_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_work_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        work_date DATE DEFAULT CURRENT_DATE,
        content TEXT,
        progress INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(150),
        content TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by INT REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS salary_records (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        month VARCHAR(30),
        amount NUMERIC(12,2),
        status VARCHAR(20) DEFAULT 'Processed'
      );

      CREATE TABLE IF NOT EXISTS overtime (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        work_date DATE,
        hours NUMERIC(5,2),
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Approved'
      );

      CREATE TABLE IF NOT EXISTS login_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        login_at TIMESTAMP DEFAULT NOW(),
        logout_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150),
        project_id INT REFERENCES projects(id),
        owner_id INT REFERENCES users(id),
        branch VARCHAR(50) DEFAULT 'main',
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INT REFERENCES users(id),
        receiver_id INT REFERENCES users(id),
        body TEXT,
        message_type VARCHAR(20) DEFAULT 'text',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        title VARCHAR(150),
        body TEXT,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Bring an existing older database forward to this schema.
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'permanent';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_level VARCHAR(30) DEFAULT 'L1';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id VARCHAR(30);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_mentor VARCHAR(120);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE;

      ALTER TABLE projects
ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS lead_id INT REFERENCES users(id);

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS start_date DATE;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium';

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS assignee_id INT REFERENCES users(id);

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id);

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium';

ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) DEFAULT 'Leave';

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(id);
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS content TEXT;
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) DEFAULT 'Leave';
      ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(id);
    `);

    // Rename legacy columns only when the new column does not already exist.
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='owner_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='created_by') THEN
          ALTER TABLE projects RENAME COLUMN owner_id TO created_by;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigned_to')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assignee_id') THEN
          ALTER TABLE tasks RENAME COLUMN assigned_to TO assignee_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='body')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='content') THEN
          ALTER TABLE announcements RENAME COLUMN body TO content;
        END IF;
      END $$;
    `);

    // If an older schema had both names, preserve old data in the canonical column.
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='owner_id') THEN
          UPDATE projects SET created_by = COALESCE(created_by, owner_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigned_to') THEN
          UPDATE tasks SET assignee_id = COALESCE(assignee_id, assigned_to);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='body') THEN
          UPDATE announcements SET content = COALESCE(content, body);
        END IF;
      END $$;
    `);


await pool.query(`
  CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL
      REFERENCES projects(id) ON DELETE CASCADE,
    user_id INT NOT NULL
      REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(project_id, user_id)
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS task_assignments (
    id SERIAL PRIMARY KEY,

    task_id INT NOT NULL
      REFERENCES tasks(id)
      ON DELETE CASCADE,

    user_id INT NOT NULL
      REFERENCES users(id)
      ON DELETE CASCADE,

    status VARCHAR(30) DEFAULT 'Pending',

    progress INT DEFAULT 0
      CHECK (progress >= 0 AND progress <= 100),

    assigned_at TIMESTAMP DEFAULT NOW(),

    started_at TIMESTAMP,

    completed_at TIMESTAMP,

    UNIQUE(task_id, user_id)
  )
`);

await pool.query(`
  ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Pending';

  ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;

  ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

  ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
`);

    await pool.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Not Started';

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

      ALTER TABLE task_assignments
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

      ALTER TABLE task_assignments
      DROP CONSTRAINT IF EXISTS task_assignments_progress_check;

      ALTER TABLE task_assignments
      ADD CONSTRAINT task_assignments_progress_check
      CHECK (progress >= 0 AND progress <= 100);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_login_logs_user_open
      ON login_logs (user_id, login_at DESC)
      WHERE logout_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON notifications (user_id, read, created_at DESC);
    `);

    console.log("Database schema created successfully");

  } catch (error) {
    console.error("DATABASE INIT ERROR:", error);
    process.exitCode = 1;

  } finally {
    await pool.end();
  }
})();